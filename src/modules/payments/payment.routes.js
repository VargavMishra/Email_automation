import { Router } from 'express';
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
  getPlanPrices,
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
      { plan: 'PRO', amount: getPlanPrices().PRO, currency: 'INR' }
    ]
  });
});

paymentRouter.post('/orders', validate(createOrderSchema), asyncHandler(async (req, res) => {
  const result = await createPaymentOrder({
    userId: req.user.id,
    ...req.validated.body
  });

  res.status(201).json(result);
}));

paymentRouter.post('/verify', validate(verifyPaymentSchema), asyncHandler(async (req, res) => {
  const result = await verifyPayment({
    userId: req.user.id,
    ...req.validated.body
  });

  res.json(result);
}));

paymentRouter.post('/mock/success', validate(mockPaymentSchema), asyncHandler(async (req, res) => {
  const result = await simulatePaymentSuccess({
    userId: req.user.id,
    ...req.validated.body
  });

  res.status(201).json(result);
}));

paymentRouter.patch('/subscription', validate(subscriptionSchema), asyncHandler(async (req, res) => {
  const subscription = await updateSubscription({
    userId: req.user.id,
    ...req.validated.body
  });

  res.json({ subscription });
}));
