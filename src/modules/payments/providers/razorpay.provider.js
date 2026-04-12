import crypto from 'node:crypto';
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

export async function createRazorpayOrder({ amount, currency, receipt, notes }) {
  const client = getClient();

  return client.orders.create({
    amount,
    currency,
    receipt,
    notes
  });
}

export function createRazorpaySignature({ orderId, paymentId, secret = env.RAZORPAY_KEY_SECRET }) {
  return crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

export function verifyRazorpaySignature({ orderId, paymentId, signature, secret = env.RAZORPAY_KEY_SECRET }) {
  if (!secret) {
    throw new AppError('Razorpay secret is not configured', 503);
  }

  const expected = createRazorpaySignature({ orderId, paymentId, secret });
  return constantTimeEqual(expected, signature);
}
