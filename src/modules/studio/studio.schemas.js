import { z } from 'zod';
import {
  deliveryToneOptions,
  emailLogStatusOptions,
  studioProjectStatusOptions
} from './studio.constants.js';

const optionalBoolean = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    return value === true || value === 'true';
  });

const objectIdParam = z.object({
  params: z.object({
    id: z.string().trim().min(1)
  })
});

const clientBody = z.object({
  name: z.string().trim().min(2),
  brandName: z.string().trim().min(2),
  email: z.string().trim().email(),
  phone: z.string().trim().optional().nullable(),
  priorityTier: z.string().trim().default('STANDARD'),
  notes: z.string().trim().optional().nullable()
});

const projectBody = z.object({
  clientId: z.string().trim().min(1),
  projectCode: z.string().trim().min(2),
  title: z.string().trim().min(2),
  status: z.enum(studioProjectStatusOptions).default('EDITING'),
  requiresFollowUp: z.boolean().optional().default(false),
  followUpSentAt: z.string().trim().optional().nullable(),
  driveFolderLink: z.string().trim().url(),
  deliveryTemplateTone: z.enum(deliveryToneOptions).optional().default('FORMAL'),
  deadlineAt: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  metadata: z.record(z.any()).optional().nullable()
});

export const studioClientCreateSchema = z.object({
  body: clientBody,
  params: z.object({}).default({}),
  query: z.object({}).default({})
});

export const studioClientUpdateSchema = z.object({
  body: clientBody.partial(),
  params: z.object({
    id: z.string().trim().min(1)
  }),
  query: z.object({}).default({})
});

export const studioProjectCreateSchema = z.object({
  body: projectBody,
  params: z.object({}).default({}),
  query: z.object({}).default({})
});

export const studioProjectUpdateSchema = z.object({
  body: projectBody.partial(),
  params: z.object({
    id: z.string().trim().min(1)
  }),
  query: z.object({}).default({})
});

export const studioListProjectsSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    status: z.enum(studioProjectStatusOptions).optional(),
    clientId: z.string().trim().optional(),
    deliverySent: optionalBoolean,
    search: z.string().trim().optional()
  }).default({})
});

export const studioListLogsSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    status: z.enum(emailLogStatusOptions).optional(),
    projectId: z.string().trim().optional(),
    clientId: z.string().trim().optional()
  }).default({})
});

export const studioManualSendSchema = z.object({
  body: z.object({
    tone: z.enum(deliveryToneOptions).optional(),
    subject: z.string().trim().optional(),
    message: z.string().trim().optional(),
    includeRevisionCta: optionalBoolean,
    includeFeedbackCta: optionalBoolean,
    force: optionalBoolean
  }).default({}),
  params: z.object({
    id: z.string().trim().min(1)
  }),
  query: z.object({}).default({})
});

export const studioExtendDeadlineSchema = z.object({
  body: z.object({
    deadlineAt: z.string().trim().min(1)
  }),
  params: z.object({
    id: z.string().trim().min(1)
  }),
  query: z.object({}).default({})
});

export const studioAddNoteSchema = z.object({
  body: z.object({
    message: z.string().trim().min(1)
  }),
  params: z.object({
    id: z.string().trim().min(1)
  }),
  query: z.object({}).default({})
});

export const studioTemplatePreviewSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    projectId: z.string().trim().min(1),
    tone: z.enum(deliveryToneOptions).optional(),
    message: z.string().trim().optional(),
    subject: z.string().trim().optional()
  })
});

export const studioIdSchema = objectIdParam.extend({
  body: z.object({}).default({}),
  query: z.object({}).default({})
});

export const studioTrackingSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({
    token: z.string().trim().min(1)
  }),
  query: z.object({}).default({})
});
