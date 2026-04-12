import { Prisma } from '@prisma/client';
import { env } from '../config/env.js';
import { logger } from '../logger.js';
import { AppError } from '../utils/AppError.js';

export function errorHandler(error, _req, res, _next) {
  let normalized = error;

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    normalized = new AppError('Database request failed', 400, { code: error.code });
  }

  const statusCode = normalized.statusCode ?? 500;
  const expose = normalized.isOperational || env.NODE_ENV !== 'production';

  logger.error(normalized.message, {
    stack: normalized.stack,
    details: normalized.details
  });

  res.status(statusCode).json({
    error: {
      message: expose ? normalized.message : 'Internal server error',
      details: expose ? normalized.details : undefined
    }
  });
}
