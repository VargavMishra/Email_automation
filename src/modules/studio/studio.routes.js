import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { openPixelBase64 } from './studio.constants.js';
import {
  studioAddNoteSchema,
  studioClientCreateSchema,
  studioClientUpdateSchema,
  studioExtendDeadlineSchema,
  studioIdSchema,
  studioListLogsSchema,
  studioListProjectsSchema,
  studioManualSendSchema,
  studioProjectCreateSchema,
  studioProjectUpdateSchema,
  studioTemplatePreviewSchema,
  studioTrackingSchema
} from './studio.schemas.js';
import { subscribeStudioEvents } from './studio.events.js';
import {
  addStudioProjectNote,
  createStudioClient,
  createStudioProject,
  deleteStudioClient,
  deleteStudioProject,
  extendStudioProjectDeadline,
  getStudioOverview,
  listDeliveryLogs,
  listStudioClients,
  listStudioProjects,
  manuallySendDeliveryEmail,
  previewStudioTemplate,
  processDeliveryQueue,
  reconcileEligibleProjects,
  trackEmailClick,
  trackEmailOpen,
  updateStudioClient,
  updateStudioProject
} from './studio.service.js';

export const studioRouter = Router();

/**
 * @openapi
 * /api/studio/tracking/open/{token}:
 *   get:
 *     summary: Register an email open event
 *     tags:
 *       - Tracking
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tracking pixel served
 */
studioRouter.get('/tracking/open/:token', validate(studioTrackingSchema), asyncHandler(async (req, res) => {
  await trackEmailOpen(req.validated.params.token);
  const pixel = Buffer.from(openPixelBase64, 'base64');

  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.send(pixel);
}));

/**
 * @openapi
 * /api/studio/tracking/click/{token}:
 *   get:
 *     summary: Register an email click event and redirect to the Drive folder
 *     tags:
 *       - Tracking
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       302:
 *         description: Redirects to the delivery target
 */
studioRouter.get('/tracking/click/:token', validate(studioTrackingSchema), asyncHandler(async (req, res) => {
  const target = await trackEmailClick(req.validated.params.token);
  res.redirect(target);
}));

studioRouter.use(authenticate);

studioRouter.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  function writeEvent(eventName, event) {
    res.write(`id: ${event.id}\n`);
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    res.flush?.();
  }

  writeEvent('connected', {
    id: `connected-${Date.now()}`,
    type: 'connected',
    occurredAt: new Date().toISOString(),
    payload: {
      userId: req.user.id
    }
  });

  const unsubscribe = subscribeStudioEvents((event) => {
    writeEvent('studio.changed', event);
  });

  const heartbeat = setInterval(() => {
    writeEvent('heartbeat', {
      id: `heartbeat-${Date.now()}`,
      type: 'heartbeat',
      occurredAt: new Date().toISOString(),
      payload: {}
    });
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
});

/**
 * @openapi
 * /api/studio/overview:
 *   get:
 *     summary: Get dashboard overview metrics
 *     tags:
 *       - Studio
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Overview totals for the studio dashboard
 */
studioRouter.get('/overview', asyncHandler(async (_req, res) => {
  const overview = await getStudioOverview();
  res.json({ overview });
}));

studioRouter.get('/dashboard', asyncHandler(async (_req, res) => {
  const [overview, clients, projects, logs] = await Promise.all([
    getStudioOverview(),
    listStudioClients(),
    listStudioProjects(),
    listDeliveryLogs()
  ]);

  res.json({
    overview,
    clients,
    projects,
    logs
  });
}));

/**
 * @openapi
 * /api/studio/clients:
 *   get:
 *     summary: List studio clients
 *     tags:
 *       - Studio
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Client list returned successfully
 */
studioRouter.get('/clients', asyncHandler(async (_req, res) => {
  const clients = await listStudioClients();
  res.json({ clients });
}));

/**
 * @openapi
 * /api/studio/clients:
 *   post:
 *     summary: Create a studio client
 *     tags:
 *       - Studio
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StudioClientInput'
 *     responses:
 *       201:
 *         description: Client created successfully
 */
studioRouter.post('/clients', validate(studioClientCreateSchema), asyncHandler(async (req, res) => {
  const client = await createStudioClient({
    input: req.validated.body,
    actorId: req.user.id
  });

  res.status(201).json({ client });
}));

/**
 * @openapi
 * /api/studio/clients/{id}:
 *   patch:
 *     summary: Update a studio client
 *     tags:
 *       - Studio
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StudioClientInput'
 *     responses:
 *       200:
 *         description: Client updated successfully
 */
studioRouter.patch('/clients/:id', validate(studioClientUpdateSchema), asyncHandler(async (req, res) => {
  const client = await updateStudioClient({
    clientId: req.validated.params.id,
    input: req.validated.body
  });

  res.json({ client });
}));

/**
 * @openapi
 * /api/studio/clients/{id}:
 *   delete:
 *     summary: Delete a studio client
 *     tags:
 *       - Studio
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Client deleted successfully
 */
studioRouter.delete('/clients/:id', validate(studioIdSchema), asyncHandler(async (req, res) => {
  await deleteStudioClient(req.validated.params.id);
  res.status(204).send();
}));

/**
 * @openapi
 * /api/studio/projects:
 *   get:
 *     summary: List studio projects
 *     tags:
 *       - Studio
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [EDITING, REVIEW, COMPLETED, HOLD]
 *       - in: query
 *         name: clientId
 *         schema:
 *           type: string
 *       - in: query
 *         name: deliverySent
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Project list returned successfully
 */
studioRouter.get('/projects', validate(studioListProjectsSchema), asyncHandler(async (req, res) => {
  const projects = await listStudioProjects(req.validated.query);
  res.json({ projects });
}));

/**
 * @openapi
 * /api/studio/projects:
 *   post:
 *     summary: Create a studio project
 *     tags:
 *       - Studio
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StudioProjectInput'
 *     responses:
 *       201:
 *         description: Project created successfully
 */
studioRouter.post('/projects', validate(studioProjectCreateSchema), asyncHandler(async (req, res) => {
  const project = await createStudioProject({
    input: req.validated.body,
    actorId: req.user.id
  });

  res.status(201).json({ project });
}));

/**
 * @openapi
 * /api/studio/projects/{id}:
 *   patch:
 *     summary: Update a studio project
 *     tags:
 *       - Studio
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StudioProjectInput'
 *     responses:
 *       200:
 *         description: Project updated successfully
 */
studioRouter.patch('/projects/:id', validate(studioProjectUpdateSchema), asyncHandler(async (req, res) => {
  const project = await updateStudioProject({
    projectId: req.validated.params.id,
    input: req.validated.body,
    actorId: req.user.id
  });

  res.json({ project });
}));

studioRouter.delete('/projects/:id', validate(studioIdSchema), asyncHandler(async (req, res) => {
  await deleteStudioProject(req.validated.params.id);
  res.status(204).send();
}));

/**
 * @openapi
 * /api/studio/projects/{id}/manual-send:
 *   post:
 *     summary: Manually send a delivery email for a project
 *     tags:
 *       - Studio
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ManualSendInput'
 *     responses:
 *       200:
 *         description: Delivery email sent successfully
 */
studioRouter.post('/projects/:id/manual-send', validate(studioManualSendSchema), asyncHandler(async (req, res) => {
  const result = await manuallySendDeliveryEmail({
    projectId: req.validated.params.id,
    overrides: req.validated.body,
    actorId: req.user.id
  });

  res.json({ result });
}));

/**
 * @openapi
 * /api/studio/projects/{id}/extend-deadline:
 *   post:
 *     summary: Extend the deadline for a studio project
 *     tags:
 *       - Studio
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [deadlineAt]
 *             properties:
 *               deadlineAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Deadline updated successfully
 */
studioRouter.post('/projects/:id/extend-deadline', validate(studioExtendDeadlineSchema), asyncHandler(async (req, res) => {
  const project = await extendStudioProjectDeadline({
    projectId: req.validated.params.id,
    deadlineAt: req.validated.body.deadlineAt,
    actorId: req.user.id
  });

  res.json({ project });
}));

/**
 * @openapi
 * /api/studio/projects/{id}/notes:
 *   post:
 *     summary: Add an internal note to a project
 *     tags:
 *       - Studio
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *     responses:
 *       201:
 *         description: Note created successfully
 */
studioRouter.post('/projects/:id/notes', validate(studioAddNoteSchema), asyncHandler(async (req, res) => {
  const note = await addStudioProjectNote({
    projectId: req.validated.params.id,
    message: req.validated.body.message,
    actorId: req.user.id
  });

  res.status(201).json({ note });
}));

/**
 * @openapi
 * /api/studio/templates/preview:
 *   get:
 *     summary: Preview the rendered delivery email template
 *     tags:
 *       - Studio
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: tone
 *         schema:
 *           type: string
 *           enum: [FORMAL, FRIENDLY, PREMIUM]
 *       - in: query
 *         name: message
 *         schema:
 *           type: string
 *       - in: query
 *         name: subject
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Template preview returned successfully
 */
studioRouter.get('/templates/preview', validate(studioTemplatePreviewSchema), asyncHandler(async (req, res) => {
  const preview = await previewStudioTemplate({
    projectId: req.validated.query.projectId,
    tone: req.validated.query.tone,
    message: req.validated.query.message,
    subject: req.validated.query.subject
  });

  res.json({ preview });
}));

/**
 * @openapi
 * /api/studio/logs:
 *   get:
 *     summary: List delivery email logs
 *     tags:
 *       - Studio
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [QUEUED, SENT, FAILED, OPENED, CLICKED]
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: string
 *       - in: query
 *         name: clientId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Delivery logs returned successfully
 */
studioRouter.get('/logs', validate(studioListLogsSchema), asyncHandler(async (req, res) => {
  const logs = await listDeliveryLogs(req.validated.query);
  res.json({ logs });
}));

/**
 * @openapi
 * /api/studio/automation/reconcile:
 *   post:
 *     summary: Re-scan eligible projects and queue them
 *     tags:
 *       - Studio
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Reconciliation completed
 */
studioRouter.post('/automation/reconcile', asyncHandler(async (_req, res) => {
  const queued = await reconcileEligibleProjects();
  res.json({ queued });
}));

/**
 * @openapi
 * /api/studio/automation/process:
 *   post:
 *     summary: Process the pending delivery queue immediately
 *     tags:
 *       - Studio
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Queue processing completed
 */
studioRouter.post('/automation/process', asyncHandler(async (_req, res) => {
  const processed = await processDeliveryQueue();
  res.json({ processed });
}));
