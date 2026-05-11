import { randomBytes } from 'crypto';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { logger } from '../../logger.js';
import { AppError } from '../../utils/AppError.js';
import { deliveryTonePresets } from './studio.constants.js';
import { validateDriveFolderLink } from './studio.drive.js';
import { sendStudioEmail } from './studio.email.js';
import { broadcastStudioEvent } from './studio.events.js';
import { notifyDeliveryFailure } from './studio.notifications.js';
import {
  coerceOptionalDate,
  computeBackoffDelayMs,
  getDeliveryEligibility,
  normalizeOptionalString,
  renderDeliveryTemplate
} from './studio.utils.js';

const staleLockThresholdMs = 2 * 60 * 1000;

function buildProjectQuery(filters = {}) {
  const where = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.clientId) {
    where.clientId = filters.clientId;
  }

  if (filters.deliverySent !== undefined) {
    where.deliveryEmailSent = filters.deliverySent;
  }

  if (filters.search) {
    where.OR = [
      { projectCode: { contains: filters.search } },
      { title: { contains: filters.search } }
    ];
  }

  return where;
}

function buildLogQuery(filters = {}) {
  const where = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.projectId) {
    where.projectId = filters.projectId;
  }

  if (filters.clientId) {
    where.clientId = filters.clientId;
  }

  return where;
}

function getNextAttemptDate(attemptNumber) {
  return new Date(Date.now() + computeBackoffDelayMs(attemptNumber, env.STUDIO_DELIVERY_RETRY_BASE_MS));
}

function serializeResponse(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return value.slice(0, 500);
  }

  try {
    return JSON.stringify(value).slice(0, 500);
  } catch {
    return String(value).slice(0, 500);
  }
}

function getDriveReadyState(validation) {
  const shareReady = validation.sharing === 'PUBLIC_VIEW' || validation.sharing === 'UNKNOWN';
  return validation.ok && shareReady;
}

async function createProjectActivity({
  projectId,
  createdById,
  type,
  message,
  metadata
}) {
  return prisma.studioProjectActivity.create({
    data: {
      projectId,
      createdById,
      type,
      message,
      metadata
    }
  });
}

async function getStudioProjectOrThrow(projectId) {
  const project = await prisma.studioProject.findUnique({
    where: { id: projectId },
    include: {
      client: true,
      dispatch: true
    }
  });

  if (!project) {
    throw new AppError('Studio project not found.', 404);
  }

  return project;
}

async function ensureDispatch(projectId) {
  return prisma.deliveryDispatch.upsert({
    where: { projectId },
    update: {
      maxAttempts: env.STUDIO_DELIVERY_MAX_RETRIES
    },
    create: {
      projectId,
      maxAttempts: env.STUDIO_DELIVERY_MAX_RETRIES
    }
  });
}

async function claimDispatch(dispatchId, workerLabel) {
  const staleCutoff = new Date(Date.now() - staleLockThresholdMs);
  const now = new Date();
  const claim = await prisma.deliveryDispatch.updateMany({
    where: {
      id: dispatchId,
      OR: [
        { status: 'PENDING' },
        { status: 'RETRYABLE' },
        { status: 'SKIPPED' },
        { status: 'FAILED' },
        {
          status: 'PROCESSING',
          lockedAt: { lt: staleCutoff }
        }
      ]
    },
    data: {
      status: 'PROCESSING',
      lockedAt: now,
      lockedBy: workerLabel,
      lastProcessedAt: now
    }
  });

  return claim.count === 1;
}

async function releaseDispatch(dispatchId, data) {
  return prisma.deliveryDispatch.update({
    where: { id: dispatchId },
    data: {
      lockedAt: null,
      lockedBy: null,
      ...data
    }
  });
}

async function markDispatchFailure({
  dispatch,
  project,
  error,
  logId
}) {
  const attempts = dispatch.attempts + 1;
  const finalFailure = attempts >= dispatch.maxAttempts;
  const nextAttemptAt = getNextAttemptDate(attempts);
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (logId) {
    await prisma.deliveryEmailLog.update({
      where: { id: logId },
      data: {
        status: 'FAILED',
        errorMessage
      }
    });
  }

  await releaseDispatch(dispatch.id, {
    status: finalFailure ? 'FAILED' : 'RETRYABLE',
    attempts,
    nextAttemptAt,
    lastError: errorMessage
  });

  await createProjectActivity({
    projectId: project.id,
    type: 'DELIVERY_FAILED',
    message: finalFailure
      ? `Delivery failed permanently after ${attempts} attempts.`
      : `Delivery attempt ${attempts} failed and will be retried.`,
    metadata: {
      error: errorMessage
    }
  });

  await notifyDeliveryFailure({
    project,
    errorMessage,
    attempts,
    finalFailure
  });

  broadcastStudioEvent('delivery.failed', {
    projectId: project.id,
    projectCode: project.projectCode,
    dispatchId: dispatch.id,
    logId,
    attempts,
    finalFailure,
    errorMessage
  });

  return {
    attempts,
    finalFailure,
    errorMessage
  };
}

async function syncDriveMetadata(project) {
  const validation = await validateDriveFolderLink(project.driveFolderLink);
  const now = new Date();

  await prisma.studioProject.update({
    where: { id: project.id },
    data: {
      driveFolderId: validation.folderId ?? project.driveFolderId ?? undefined,
      driveValidatedAt: now,
      driveShareMode: validation.sharing,
      lastEligibilityCheckAt: now
    }
  });

  return validation;
}

async function sendDeliveryAttempt({
  project,
  dispatch,
  mode = 'AUTOMATED',
  overrides = {},
  force = false,
  actorId
}) {
  let logEntry;
  let attemptError = null;
  try {
    const eligibility = getDeliveryEligibility(project);

    if (!force && !eligibility.eligible) {
      await releaseDispatch(dispatch.id, {
        status: 'SKIPPED',
        lastError: eligibility.reasons.join(' ')
      });

      broadcastStudioEvent('delivery.skipped', {
        projectId: project.id,
        projectCode: project.projectCode,
        dispatchId: dispatch.id,
        reasons: eligibility.reasons
      });

      throw new AppError(eligibility.reasons.join(' '), 409, eligibility);
    }

    const driveValidation = await syncDriveMetadata(project);
    logger.info(`Drive validation completed for project ${project.id}`);

    if (!getDriveReadyState(driveValidation)) {
      const driveError = new AppError(
        driveValidation.reason ?? 'Google Drive link is not ready for delivery.',
        409,
        driveValidation
      );

      throw driveError;
    }

    const openTrackingToken = randomBytes(18).toString('hex');
    const clickTrackingToken = randomBytes(18).toString('hex');
    const rendered = renderDeliveryTemplate({
      project: {
        ...project,
        driveFolderLink: driveValidation.webViewLink ?? project.driveFolderLink
      },
      tone: overrides.tone ?? project.deliveryTemplateTone,
      subjectOverride: overrides.subject,
      messageOverride: overrides.message,
      includeRevisionCta: overrides.includeRevisionCta ?? true,
      includeFeedbackCta: overrides.includeFeedbackCta ?? true,
      appUrl: env.APP_URL,
      openTrackingToken,
      clickTrackingToken
    });

    logEntry = await prisma.deliveryEmailLog.create({
      data: {
        projectId: project.id,
        clientId: project.clientId,
        dispatchId: dispatch.id,
        recipientEmail: project.client.email,
        subject: rendered.subject,
        htmlSnapshot: rendered.html,
        textSnapshot: rendered.text,
        tone: rendered.tone,
        sendMode: mode,
        provider: env.EMAIL_PROVIDER,
        status: 'QUEUED',
        openTrackingToken,
        clickTrackingToken
      }
    });

    broadcastStudioEvent('delivery.queued', {
      projectId: project.id,
      projectCode: project.projectCode,
      dispatchId: dispatch.id,
      logId: logEntry.id,
      sendMode: mode,
      recipientEmail: project.client.email
    });

    logger.info(`Calling sendStudioEmail for project ${project.id}`);
    const result = await sendStudioEmail({
      to: project.client.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      headers: {
        'X-Project-Code': project.projectCode,
        'X-Dispatch-Mode': mode
      }
    });
    logger.info(`Finished sendStudioEmail for project ${project.id}`);
    const sentAt = new Date();

    await prisma.deliveryEmailLog.update({
      where: { id: logEntry.id },
      data: {
        status: 'SENT',
        provider: result.provider,
        providerMessageId: result.messageId ?? undefined,
        sentAt
      }
    });

    await prisma.studioProject.update({
      where: { id: project.id },
      data: {
        deliveryEmailSent: true,
        deliverySentAt: sentAt,
        driveFolderId: driveValidation.folderId ?? project.driveFolderId ?? undefined,
        driveValidatedAt: sentAt,
        driveShareMode: driveValidation.sharing
      }
    });

    await releaseDispatch(dispatch.id, {
      status: 'SENT',
      attempts: dispatch.attempts + 1,
      sentAt,
      lastResponseMessage: serializeResponse(result.response),
      lastError: null
    });

    await createProjectActivity({
      projectId: project.id,
      createdById: actorId,
      type: 'DELIVERY_SENT',
      message: mode === 'MANUAL'
        ? 'Delivery email was sent manually from the admin dashboard.'
        : 'Delivery email was sent automatically.',
      metadata: {
        recipientEmail: project.client.email,
        logId: logEntry.id
      }
    });

    broadcastStudioEvent('delivery.sent', {
      projectId: project.id,
      projectCode: project.projectCode,
      dispatchId: dispatch.id,
      logId: logEntry.id,
      recipientEmail: project.client.email,
      sentAt
    });

    return {
      logId: logEntry.id,
      subject: rendered.subject,
      preview: rendered.preview,
      deliverySentAt: sentAt
    };
  } catch (error) {
    attemptError = error;

    if (error instanceof AppError && error.message === getDeliveryEligibility(project).reasons.join(' ')) {
      throw error;
    }

    try {
      await markDispatchFailure({
        dispatch,
        project,
        error,
        logId: logEntry?.id
      });
    } catch (markError) {
      logger.error(`Failed to mark dispatch failure for project ${project.id}`, {
        dispatchId: dispatch?.id,
        error: markError.message,
        originalError: error.message
      });
    }

    throw error;
  } finally {
    if (!attemptError || !dispatch?.id) {
      return;
    }

    try {
      const currentDispatch = await prisma.deliveryDispatch.findUnique({
        where: { id: dispatch.id },
        select: { status: true }
      });

      if (currentDispatch?.status === 'PROCESSING') {
        await releaseDispatch(dispatch.id, {
          status: 'RETRYABLE',
          attempts: dispatch.attempts + 1,
          nextAttemptAt: getNextAttemptDate(dispatch.attempts + 1),
          lastError: attemptError instanceof Error ? attemptError.message : String(attemptError)
        });
      }
    } catch (releaseError) {
      logger.error(`Emergency release failed for dispatch ${dispatch.id}`, {
        error: releaseError.message
      });
    }
  }
}

export async function listStudioClients() {
  return prisma.studioClient.findMany({
    orderBy: {
      updatedAt: 'desc'
    }
  });
}

export async function createStudioClient({ input, actorId }) {
  const client = await prisma.studioClient.create({
    data: {
      ownerId: actorId,
      name: input.name,
      brandName: input.brandName,
      email: input.email,
      phone: normalizeOptionalString(input.phone),
      priorityTier: normalizeOptionalString(input.priorityTier) ?? 'STANDARD',
      notes: normalizeOptionalString(input.notes)
    }
  });

  broadcastStudioEvent('client.created', {
    clientId: client.id,
    brandName: client.brandName
  });

  return client;
}

export async function updateStudioClient({ clientId, input }) {
  const existing = await prisma.studioClient.findUnique({
    where: { id: clientId }
  });

  if (!existing) {
    throw new AppError('Studio client not found.', 404);
  }

  const client = await prisma.studioClient.update({
    where: { id: clientId },
    data: {
      name: input.name ?? undefined,
      brandName: input.brandName ?? undefined,
      email: input.email ?? undefined,
      phone: input.phone === undefined ? undefined : normalizeOptionalString(input.phone),
      priorityTier: input.priorityTier === undefined
        ? undefined
        : normalizeOptionalString(input.priorityTier) ?? 'STANDARD',
      notes: input.notes === undefined ? undefined : normalizeOptionalString(input.notes)
    }
  });

  broadcastStudioEvent('client.updated', {
    clientId: client.id,
    brandName: client.brandName
  });

  return client;
}

export async function deleteStudioClient(clientId) {
  const projectCount = await prisma.studioProject.count({
    where: {
      clientId
    }
  });

  if (projectCount > 0) {
    throw new AppError('Delete or reassign the client projects before removing the client.', 409);
  }

  const client = await prisma.studioClient.delete({
    where: { id: clientId }
  });

  broadcastStudioEvent('client.deleted', {
    clientId
  });

  return client;
}

export async function listStudioProjects(filters = {}) {
  return prisma.studioProject.findMany({
    where: buildProjectQuery(filters),
    include: {
      client: true,
      dispatch: true,
      activities: {
        orderBy: {
          createdAt: 'desc'
        },
        take: 3
      }
    },
    orderBy: {
      updatedAt: 'desc'
    }
  });
}

function normalizeProjectData(input, existing = null) {
  return {
    clientId: input.clientId ?? existing?.clientId,
    projectCode: input.projectCode ?? existing?.projectCode,
    title: input.title ?? existing?.title,
    status: input.status ?? existing?.status,
    requiresFollowUp: input.requiresFollowUp ?? existing?.requiresFollowUp ?? false,
    followUpSentAt: input.followUpSentAt === undefined
      ? undefined
      : coerceOptionalDate(input.followUpSentAt),
    driveFolderLink: input.driveFolderLink ?? existing?.driveFolderLink,
    deliveryTemplateTone: input.deliveryTemplateTone ?? existing?.deliveryTemplateTone ?? 'FORMAL',
    deadlineAt: input.deadlineAt === undefined ? undefined : coerceOptionalDate(input.deadlineAt),
    notes: input.notes === undefined ? undefined : normalizeOptionalString(input.notes),
    metadata: input.metadata === undefined ? undefined : input.metadata
  };
}

async function upsertEligibleDispatch(project, driveValidation) {
  const driveReady = getDriveReadyState(driveValidation);

  return prisma.deliveryDispatch.upsert({
    where: { projectId: project.id },
    update: {
      status: driveReady ? 'PENDING' : 'RETRYABLE',
      nextAttemptAt: driveReady ? new Date() : getNextAttemptDate(1),
      maxAttempts: env.STUDIO_DELIVERY_MAX_RETRIES,
      lastError: driveReady ? null : driveValidation.reason,
      lockedAt: null,
      lockedBy: null
    },
    create: {
      projectId: project.id,
      status: driveReady ? 'PENDING' : 'RETRYABLE',
      nextAttemptAt: driveReady ? new Date() : getNextAttemptDate(1),
      maxAttempts: env.STUDIO_DELIVERY_MAX_RETRIES,
      lastError: driveReady ? null : driveValidation.reason
    }
  });
}

export async function queueProjectIfEligible(projectId) {
  const project = await getStudioProjectOrThrow(projectId);
  const eligibility = getDeliveryEligibility(project);
  const driveValidation = await syncDriveMetadata(project);

  if (!eligibility.eligible) {
    if (project.dispatch) {
      await releaseDispatch(project.dispatch.id, {
        status: 'SKIPPED',
        lastError: eligibility.reasons.join(' ')
      });
    }

    broadcastStudioEvent('delivery.skipped', {
      projectId: project.id,
      projectCode: project.projectCode,
      dispatchId: project.dispatch?.id,
      reasons: eligibility.reasons
    });

    return {
      queued: false,
      eligibility,
      driveValidation
    };
  }

  const dispatch = await upsertEligibleDispatch(project, driveValidation);

  await createProjectActivity({
    projectId: project.id,
    type: 'DELIVERY_QUEUED',
    message: getDriveReadyState(driveValidation)
      ? 'Project is eligible and queued for delivery.'
      : 'Project is eligible, but Drive validation must pass before delivery can be sent.',
    metadata: {
      dispatchId: dispatch.id,
      driveShareMode: driveValidation.sharing
    }
  });

  broadcastStudioEvent('delivery.queued', {
    projectId: project.id,
    projectCode: project.projectCode,
    dispatchId: dispatch.id,
    dispatchStatus: dispatch.status,
    queued: getDriveReadyState(driveValidation)
  });

  return {
    queued: getDriveReadyState(driveValidation),
    dispatch,
    eligibility,
    driveValidation
  };
}

export async function createStudioProject({ input, actorId }) {
  const driveValidation = await validateDriveFolderLink(input.driveFolderLink);
  const payload = normalizeProjectData(input);
  const project = await prisma.studioProject.create({
    data: {
      ...payload,
      ownerId: actorId,
      driveFolderId: driveValidation.folderId ?? undefined,
      driveValidatedAt: new Date(),
      driveShareMode: driveValidation.sharing,
      notes: payload.notes ?? null
    }
  });

  if (payload.notes) {
    await createProjectActivity({
      projectId: project.id,
      createdById: actorId,
      type: 'NOTE',
      message: payload.notes
    });
  }

  await queueProjectIfEligible(project.id);

  const createdProject = await getStudioProjectOrThrow(project.id);

  broadcastStudioEvent('project.created', {
    projectId: createdProject.id,
    projectCode: createdProject.projectCode,
    status: createdProject.status
  });

  return createdProject;
}

export async function updateStudioProject({ projectId, input, actorId }) {
  const existing = await getStudioProjectOrThrow(projectId);
  const payload = normalizeProjectData(input, existing);
  const driveValidation = input.driveFolderLink
    ? await validateDriveFolderLink(input.driveFolderLink)
    : {
        folderId: existing.driveFolderId,
        sharing: existing.driveShareMode
      };
  const updated = await prisma.studioProject.update({
    where: { id: projectId },
    data: {
      clientId: payload.clientId,
      projectCode: payload.projectCode,
      title: payload.title,
      status: payload.status,
      requiresFollowUp: payload.requiresFollowUp,
      followUpSentAt: payload.followUpSentAt,
      driveFolderLink: payload.driveFolderLink,
      driveFolderId: driveValidation.folderId ?? undefined,
      driveValidatedAt: new Date(),
      driveShareMode: driveValidation.sharing ?? existing.driveShareMode,
      deliveryTemplateTone: payload.deliveryTemplateTone,
      deadlineAt: payload.deadlineAt,
      notes: payload.notes,
      metadata: payload.metadata
    }
  });

  if (input.status && input.status !== existing.status) {
    await createProjectActivity({
      projectId,
      createdById: actorId,
      type: 'STATUS_UPDATED',
      message: `Project status changed from ${existing.status} to ${input.status}.`
    });
  }

  if (payload.followUpSentAt && !existing.followUpSentAt) {
    await createProjectActivity({
      projectId,
      createdById: actorId,
      type: 'FOLLOW_UP_SENT',
      message: 'Client check-in has been marked as completed.'
    });
  }

  if (input.deadlineAt && String(input.deadlineAt) !== String(existing.deadlineAt ?? '')) {
    await createProjectActivity({
      projectId,
      createdById: actorId,
      type: 'DEADLINE_EXTENDED',
      message: `Deadline was updated to ${payload.deadlineAt?.toISOString()}.`
    });
  }

  await queueProjectIfEligible(projectId);

  broadcastStudioEvent('project.updated', {
    projectId: updated.id,
    projectCode: updated.projectCode,
    status: updated.status
  });

  return updated;
}

export async function extendStudioProjectDeadline({ projectId, deadlineAt, actorId }) {
  const parsedDate = coerceOptionalDate(deadlineAt);

  if (!parsedDate) {
    throw new AppError('A valid deadline timestamp is required.', 400);
  }

  const project = await prisma.studioProject.update({
    where: { id: projectId },
    data: {
      deadlineAt: parsedDate
    }
  });

  await createProjectActivity({
    projectId,
    createdById: actorId,
    type: 'DEADLINE_EXTENDED',
    message: `Deadline was extended to ${parsedDate.toISOString()}.`
  });

  return project;
}

export async function addStudioProjectNote({ projectId, message, actorId }) {
  await getStudioProjectOrThrow(projectId);

  const note = await createProjectActivity({
    projectId,
    createdById: actorId,
    type: 'NOTE',
    message
  });

  return note;
}

export async function previewStudioTemplate({ projectId, tone, message, subject }) {
  const project = await getStudioProjectOrThrow(projectId);

  return renderDeliveryTemplate({
    project,
    tone: tone ?? project.deliveryTemplateTone,
    messageOverride: message,
    subjectOverride: subject,
    appUrl: env.APP_URL
  });
}

export async function manuallySendDeliveryEmail({ projectId, overrides, actorId }) {
  const project = await getStudioProjectOrThrow(projectId);
  const eligibility = getDeliveryEligibility(project);

  if (!overrides.force && !eligibility.eligible) {
    throw new AppError(eligibility.reasons.join(' '), 409, eligibility);
  }

  const dispatch = await ensureDispatch(projectId);

  if (dispatch.status === 'PROCESSING' && dispatch.lockedAt && dispatch.lockedAt.getTime() > Date.now() - staleLockThresholdMs) {
    throw new AppError('A delivery attempt is already in progress for this project.', 409);
  }

  const claimed = await claimDispatch(dispatch.id, `manual:${actorId ?? 'system'}`);

  if (!claimed) {
    throw new AppError('Unable to acquire the delivery lock for this project.', 409);
  }

  const refreshedProject = await getStudioProjectOrThrow(projectId);
  const refreshedDispatch = await prisma.deliveryDispatch.findUnique({
    where: { id: dispatch.id }
  });

  return sendDeliveryAttempt({
    project: refreshedProject,
    dispatch: refreshedDispatch,
    mode: 'MANUAL',
    overrides,
    force: overrides.force ?? false,
    actorId
  });
}

export async function listDeliveryLogs(filters = {}) {
  return prisma.deliveryEmailLog.findMany({
    where: buildLogQuery(filters),
    include: {
      project: {
        include: {
          client: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
}

export async function getStudioOverview() {
  const readyWhere = {
    status: 'COMPLETED',
    deliveryEmailSent: false,
    OR: [
      { requiresFollowUp: false },
      { followUpSentAt: { not: null } }
    ]
  };
  const failedWhere = {
    status: 'FAILED'
  };

  const [
    totalClients,
    activeProjects,
    readyToDeliver,
    sentDeliveries,
    failedDispatches
  ] = await Promise.all([
    prisma.studioClient.count(),
    prisma.studioProject.count({
      where: {
        deliveryEmailSent: false
      }
    }),
    prisma.studioProject.count({
      where: readyWhere
    }),
    prisma.deliveryEmailLog.count({
      where: {
        status: 'SENT'
      }
    }),
    prisma.deliveryDispatch.count({
      where: failedWhere
    })
  ]);

  return {
    totalClients,
    activeProjects,
    readyToDeliver,
    sentDeliveries,
    failedDispatches,
    templatePresets: Object.entries(deliveryTonePresets).map(([key, value]) => ({
      key,
      label: value.label
    }))
  };
}

export async function reconcileEligibleProjects() {
  const candidates = await prisma.studioProject.findMany({
    where: {
      status: 'COMPLETED',
      deliveryEmailSent: false,
      OR: [
        { requiresFollowUp: false },
        { followUpSentAt: { not: null } }
      ]
    },
    include: {
      client: true,
      dispatch: true
    },
    orderBy: {
      updatedAt: 'desc'
    },
    take: env.STUDIO_DELIVERY_BATCH_SIZE
  });

  const results = [];

  for (const project of candidates) {
    const result = await queueProjectIfEligible(project.id);
    results.push({
      projectId: project.id,
      projectCode: project.projectCode,
      queued: result.queued
    });
  }

  return results;
}

export async function processDeliveryQueue() {
  logger.info('Starting processDeliveryQueue');
  const now = new Date();
  const staleCutoff = new Date(Date.now() - staleLockThresholdMs);
  const dueDispatches = await prisma.deliveryDispatch.findMany({
    where: {
      OR: [
        {
          status: {
            in: ['PENDING', 'RETRYABLE']
          },
          nextAttemptAt: {
            lte: now
          }
        },
        {
          status: 'PROCESSING',
          lockedAt: {
            lt: staleCutoff
          }
        }
      ]
    },
    include: {
      project: {
        include: {
          client: true
        }
      }
    },
    orderBy: {
      nextAttemptAt: 'asc'
    },
    take: env.STUDIO_DELIVERY_BATCH_SIZE
  });

  logger.info(`Found ${dueDispatches.length} due dispatches`);

  const results = [];

  for (const dispatch of dueDispatches) {
    try {
      logger.info(`Claiming dispatch ${dispatch.id}`);
      const claimed = await claimDispatch(dispatch.id, 'automation-worker');

      if (!claimed) {
        logger.info(`Failed to claim dispatch ${dispatch.id}`);
        continue;
      }

      const latestDispatch = await prisma.deliveryDispatch.findUnique({
        where: { id: dispatch.id }
      });
      const latestProject = await getStudioProjectOrThrow(dispatch.projectId);
      
      const eligibility = getDeliveryEligibility(latestProject);

      if (!eligibility.eligible) {
        await releaseDispatch(dispatch.id, {
          status: latestProject.deliveryEmailSent ? 'SENT' : 'SKIPPED',
          lastError: eligibility.reasons.join(' ')
        });

        broadcastStudioEvent('delivery.skipped', {
          projectId: latestProject.id,
          projectCode: latestProject.projectCode,
          dispatchId: dispatch.id,
          reasons: eligibility.reasons
        });

        results.push({
          projectId: latestProject.id,
          skipped: true,
          reasons: eligibility.reasons
        });

        continue;
      }

      logger.info(`Sending delivery attempt for project ${latestProject.id}`);
      const result = await sendDeliveryAttempt({
        project: latestProject,
        dispatch: latestDispatch,
        mode: 'AUTOMATED'
      });
      logger.info(`Successfully sent delivery attempt for project ${latestProject.id}`);

      results.push({
        projectId: latestProject.id,
        sent: true,
        logId: result.logId
      });
    } catch (error) {
      logger.error(`Automated studio delivery failed for dispatch ${dispatch.id}`, {
        error: error.message,
        stack: error.stack
      });

      // sendDeliveryAttempt already records attempts/status on failure.
      // Only force-release if the dispatch is still stuck in PROCESSING.
      try {
        const currentDispatch = await prisma.deliveryDispatch.findUnique({
          where: { id: dispatch.id },
          select: { status: true }
        });

        if (currentDispatch?.status === 'PROCESSING') {
          await releaseDispatch(dispatch.id, {
            status: 'RETRYABLE',
            lastError: error.message
          });
        }
      } catch (releaseError) {
        logger.error(`Failed to release stuck dispatch ${dispatch.id}`, {
          error: releaseError.message
        });
      }

      results.push({
        dispatchId: dispatch.id,
        sent: false,
        error: error.message
      });
    }
  }

  return results;
}

export async function deleteStudioProject(projectId) {
  const existing = await prisma.studioProject.findUnique({
    where: { id: projectId }
  });

  if (!existing) {
    throw new AppError('Studio project not found.', 404);
  }

  // Use a transaction to ensure all related data is cleaned up
  await prisma.$transaction([
    prisma.deliveryDispatch.deleteMany({ where: { projectId } }),
    prisma.deliveryEmailLog.deleteMany({ where: { projectId } }),
    prisma.studioProjectActivity.deleteMany({ where: { projectId } }),
    prisma.studioProject.delete({ where: { id: projectId } })
  ]);

  broadcastStudioEvent('project.deleted', {
    projectId
  });

  return existing;
}

export async function trackEmailOpen(token) {
  const logEntry = await prisma.deliveryEmailLog.findUnique({
    where: { openTrackingToken: token }
  });

  if (!logEntry) {
    return false;
  }

  if (!logEntry.openedAt) {
    await prisma.deliveryEmailLog.update({
      where: { id: logEntry.id },
      data: {
        openedAt: new Date(),
        status: logEntry.clickedAt ? 'CLICKED' : 'OPENED'
      }
    });

    broadcastStudioEvent('delivery.opened', {
      projectId: logEntry.projectId,
      logId: logEntry.id,
      recipientEmail: logEntry.recipientEmail
    });
  }

  return true;
}

export async function trackEmailClick(token) {
  const logEntry = await prisma.deliveryEmailLog.findUnique({
    where: { clickTrackingToken: token },
    include: {
      project: true
    }
  });

  if (!logEntry) {
    return env.CLIENT_URL;
  }

  await prisma.deliveryEmailLog.update({
    where: { id: logEntry.id },
    data: {
      clickedAt: new Date(),
      status: 'CLICKED'
    }
  });

  broadcastStudioEvent('delivery.clicked', {
    projectId: logEntry.projectId,
    projectCode: logEntry.project.projectCode,
    logId: logEntry.id,
    recipientEmail: logEntry.recipientEmail
  });

  return logEntry.project.driveFolderLink;
}
