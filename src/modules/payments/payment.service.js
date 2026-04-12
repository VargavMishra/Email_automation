import { env } from '../../config/env.js';
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
  if (plan === 'FREE') {
    return null;
  }

  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date;
}

export async function createPaymentOrder({ userId, plan = 'PRO', currency = 'INR' }) {
  if (plan === 'FREE') {
    throw new AppError('Free plan does not require payment', 400);
  }

  const amount = planPrices[plan];
  const provider = providerEnum();
  const receipt = `sub_${userId}_${Date.now()}`.slice(0, 40);

  const order = provider === 'RAZORPAY'
    ? await createRazorpayOrder({
        amount,
        currency,
        receipt,
        notes: {
          userId,
          plan
        }
      })
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

  return {
    provider,
    order,
    keyId: provider === 'RAZORPAY' ? env.RAZORPAY_KEY_ID : undefined
  };
}

export async function verifyPayment({ userId, razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  const payment = await prisma.payment.findFirst({
    where: {
      userId,
      providerOrderId: razorpayOrderId,
      provider: 'RAZORPAY'
    }
  });

  if (!payment) {
    throw new AppError('Payment order not found', 404);
  }

  const valid = verifyRazorpaySignature({
    orderId: razorpayOrderId,
    paymentId: razorpayPaymentId,
    signature: razorpaySignature
  });

  if (!valid) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED' }
    });
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
  const mockPayment = createMockPayment();
  const order = createMockOrder({ amount: planPrices[plan], currency: 'INR' });

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

export async function updateSubscription({ userId, plan, status = 'ACTIVE', provider = providerEnum() }) {
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

export function getPlanPrices() {
  return planPrices;
}
