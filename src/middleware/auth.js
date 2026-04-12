import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';

export async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new AppError('Authentication required', 401);
    }

    const token = header.slice('Bearer '.length);
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { subscription: true }
    });

    if (!user) {
      throw new AppError('Authentication required', 401);
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }

    return next(new AppError('Authentication required', 401));
  }
}

export function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError('Forbidden', 403));
    }

    return next();
  };
}

export function requirePlan(...plans) {
  return (req, _res, next) => {
    const plan = req.user?.subscription?.plan ?? 'FREE';
    const status = req.user?.subscription?.status ?? 'ACTIVE';

    if (status !== 'ACTIVE' || !plans.includes(plan)) {
      return next(new AppError('Subscription upgrade required', 402));
    }

    return next();
  };
}
