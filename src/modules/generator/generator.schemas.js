import { z } from 'zod';

const featureFlagsSchema = z.object({
  auth: z.boolean().optional(),
  rbac: z.boolean().optional(),
  payments: z.boolean().optional(),
  subscriptions: z.boolean().optional(),
  apiGenerator: z.boolean().optional(),
  email: z.boolean().optional(),
  docker: z.boolean().optional(),
  swagger: z.boolean().optional(),
  logging: z.boolean().optional(),
  rateLimit: z.boolean().optional()
}).default({});

const fieldSchema = z.object({
  name: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/),
  type: z.enum(['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json']).default('String'),
  required: z.boolean().default(true),
  unique: z.boolean().default(false),
  default: z.union([z.string(), z.number(), z.boolean()]).optional()
});

export const entitySchema = z.object({
  name: z.string().regex(/^[A-Z][A-Za-z0-9]*$/),
  route: z.string().regex(/^[a-z][a-z0-9-]*$/).optional(),
  access: z.enum(['public', 'authenticated', 'admin', 'pro']).default('authenticated'),
  fields: z.array(fieldSchema).min(1)
});

export const generationRequestBodySchema = z.object({
  projectName: z.string().min(1).max(120),
  packageName: z.string().regex(/^[a-z0-9][a-z0-9-_]*$/).optional(),
  description: z.string().max(240).optional(),
  features: featureFlagsSchema,
  paymentMode: z.enum(['razorpay', 'mock']).default('mock'),
  crudEntities: z.array(entitySchema).default([])
});

export const generationRequestSchema = z.object({
  body: generationRequestBodySchema
});

export const projectIdSchema = z.object({
  params: z.object({
    id: z.string().min(1)
  })
});
