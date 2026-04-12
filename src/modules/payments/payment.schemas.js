import { z } from 'zod';

export const planSchema = z.enum(['FREE', 'PRO']);

export const createOrderSchema = z.object({
  body: z.object({
    plan: planSchema.default('PRO'),
    currency: z.string().length(3).default('INR')
  })
});

export const verifyPaymentSchema = z.object({
  body: z.object({
    razorpayOrderId: z.string().min(1),
    razorpayPaymentId: z.string().min(1),
    razorpaySignature: z.string().min(1)
  })
});

export const mockPaymentSchema = z.object({
  body: z.object({
    plan: planSchema.default('PRO')
  })
});

export const subscriptionSchema = z.object({
  body: z.object({
    plan: planSchema,
    status: z.enum(['ACTIVE', 'CANCELED', 'PAST_DUE']).default('ACTIVE')
  })
});
