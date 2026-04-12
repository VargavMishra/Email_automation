import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../logger.js';

function createTransport() {
  if (!env.SMTP_HOST) {
    return null;
  }

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER
      ? {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS
        }
      : undefined
  });
}

const transport = createTransport();

async function sendMail(message) {
  if (!transport) {
    logger.warn('SMTP is not configured; email skipped.', { to: message.to, subject: message.subject });
    return { skipped: true };
  }

  return transport.sendMail({
    from: env.EMAIL_FROM,
    ...message
  });
}

export async function sendWelcomeEmail(user) {
  return sendMail({
    to: user.email,
    subject: 'Welcome to SaaS Builder',
    text: `Hi ${user.name ?? 'there'}, welcome to SaaS Builder.`,
    html: `<p>Hi ${user.name ?? 'there'},</p><p>Welcome to SaaS Builder.</p>`
  });
}

export async function sendPasswordResetEmail(user, token) {
  const url = `${env.CLIENT_URL}/reset-password?token=${encodeURIComponent(token)}`;

  return sendMail({
    to: user.email,
    subject: 'Reset your SaaS Builder password',
    text: `Reset your password: ${url}`,
    html: `<p>Use this link to reset your password. It expires in ${env.PASSWORD_RESET_TTL_MINUTES} minutes.</p><p><a href="${url}">Reset password</a></p>`
  });
}
