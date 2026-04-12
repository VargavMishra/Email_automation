export function renderPaymentFiles() {
  return {
    'src/modules/payments/payment.schemas.js': `import { z } from 'zod';

const planSchema = z.enum(['FREE', 'PRO']);

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
`,
    'src/modules/payments/providers/razorpay.provider.js': `import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import { env } from '../../../config/env.js';
import { AppError } from '../../../utils/AppError.js';
import { constantTimeEqual } from '../../../utils/security.js';

function getClient() {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new AppError('Razorpay credentials are not configured', 503);
  }

  return new Razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET
  });
}

export function createRazorpaySignature({ orderId, paymentId, secret = env.RAZORPAY_KEY_SECRET }) {
  return crypto.createHmac('sha256', secret).update(\`\${orderId}|\${paymentId}\`).digest('hex');
}

export function verifyRazorpaySignature({ orderId, paymentId, signature, secret = env.RAZORPAY_KEY_SECRET }) {
  if (!secret) throw new AppError('Razorpay secret is not configured', 503);
  const expected = createRazorpaySignature({ orderId, paymentId, secret });
  return constantTimeEqual(expected, signature);
}

export async function createRazorpayOrder({ amount, currency, receipt, notes }) {
  return getClient().orders.create({ amount, currency, receipt, notes });
}
`,
    'src/modules/payments/providers/mock.provider.js': `import { createOpaqueToken } from '../../../utils/security.js';

export function createMockOrder({ amount, currency }) {
  return {
    id: \`mock_order_\${createOpaqueToken(8)}\`,
    amount,
    currency,
    status: 'created',
    provider: 'mock'
  };
}

export function createMockPayment() {
  return {
    id: \`mock_payment_\${createOpaqueToken(8)}\`,
    signature: \`mock_signature_\${createOpaqueToken(8)}\`
  };
}
`,
    'src/modules/payments/payment.service.js': `import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { AppError } from '../../utils/AppError.js';
import { createMockOrder, createMockPayment } from './providers/mock.provider.js';
import { createRazorpayOrder, verifyRazorpaySignature } from './providers/razorpay.provider.js';

const planPrices = {
  FREE: 0,
  PRO: 99900
};

function providerEnum(provider = env.PAYMENT_PROVIDER) {
  return provider === 'razorpay' ? 'RAZORPAY' : 'MOCK';
}

function nextPeriodEnd(plan) {
  if (plan === 'FREE') return null;

  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date;
}

export async function createPaymentOrder({ userId, plan = 'PRO', currency = 'INR' }) {
  if (plan === 'FREE') throw new AppError('Free plan does not require payment', 400);

  const amount = planPrices[plan];
  const provider = providerEnum();
  const receipt = \`sub_\${userId}_\${Date.now()}\`.slice(0, 40);
  const order = provider === 'RAZORPAY'
    ? await createRazorpayOrder({ amount, currency, receipt, notes: { userId, plan } })
    : createMockOrder({ amount, currency });

  await prisma.payment.create({
    data: {
      userId,
      provider,
      status: 'CREATED',
      plan,
      amount,
      currency,
      providerOrderId: order.id,
      metadata: order
    }
  });

  return { provider, order, keyId: provider === 'RAZORPAY' ? env.RAZORPAY_KEY_ID : undefined };
}

export async function verifyPayment({ userId, razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  const payment = await prisma.payment.findFirst({
    where: {
      userId,
      provider: 'RAZORPAY',
      providerOrderId: razorpayOrderId
    }
  });

  if (!payment) throw new AppError('Payment order not found', 404);

  const valid = verifyRazorpaySignature({
    orderId: razorpayOrderId,
    paymentId: razorpayPaymentId,
    signature: razorpaySignature
  });

  if (!valid) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
    throw new AppError('Invalid payment signature', 400);
  }

  const updatedPayment = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'PAID',
      providerPaymentId: razorpayPaymentId,
      providerSignature: razorpaySignature
    }
  });

  const subscription = await updateSubscription({
    userId,
    plan: payment.plan,
    status: 'ACTIVE',
    provider: 'RAZORPAY'
  });

  return { payment: updatedPayment, subscription };
}

export async function simulatePaymentSuccess({ userId, plan = 'PRO' }) {
  const order = createMockOrder({ amount: planPrices[plan], currency: 'INR' });
  const mockPayment = createMockPayment();

  const payment = await prisma.payment.create({
    data: {
      userId,
      provider: 'MOCK',
      status: 'PAID',
      plan,
      amount: planPrices[plan],
      currency: 'INR',
      providerOrderId: order.id,
      providerPaymentId: mockPayment.id,
      providerSignature: mockPayment.signature,
      metadata: { order, payment: mockPayment }
    }
  });

  const subscription = await updateSubscription({
    userId,
    plan,
    status: 'ACTIVE',
    provider: 'MOCK'
  });

  return { payment, subscription };
}

export function updateSubscription({ userId, plan, status = 'ACTIVE', provider = providerEnum() }) {
  return prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      plan,
      status,
      provider,
      currentPeriodStart: new Date(),
      currentPeriodEnd: nextPeriodEnd(plan)
    },
    update: {
      plan,
      status,
      provider,
      currentPeriodStart: new Date(),
      currentPeriodEnd: nextPeriodEnd(plan)
    }
  });
}
`,
    'src/modules/payments/payment.routes.js': `import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createOrderSchema,
  mockPaymentSchema,
  subscriptionSchema,
  verifyPaymentSchema
} from './payment.schemas.js';
import {
  createPaymentOrder,
  simulatePaymentSuccess,
  updateSubscription,
  verifyPayment
} from './payment.service.js';

export const paymentRouter = Router();

paymentRouter.use(authenticate);

paymentRouter.get('/plans', (_req, res) => {
  res.json({
    plans: [
      { plan: 'FREE', amount: 0, currency: 'INR' },
      { plan: 'PRO', amount: 99900, currency: 'INR' }
    ]
  });
});

paymentRouter.post('/orders', validate(createOrderSchema), asyncHandler(async (req, res) => {
  const result = await createPaymentOrder({ userId: req.user.id, ...req.validated.body });
  res.status(201).json(result);
}));

paymentRouter.post('/verify', validate(verifyPaymentSchema), asyncHandler(async (req, res) => {
  const result = await verifyPayment({ userId: req.user.id, ...req.validated.body });
  res.json(result);
}));

paymentRouter.post('/mock/success', validate(mockPaymentSchema), asyncHandler(async (req, res) => {
  const result = await simulatePaymentSuccess({ userId: req.user.id, ...req.validated.body });
  res.status(201).json(result);
}));

paymentRouter.patch('/subscription', validate(subscriptionSchema), asyncHandler(async (req, res) => {
  const subscription = await updateSubscription({ userId: req.user.id, ...req.validated.body });
  res.json({ subscription });
}));
`
  };
}
