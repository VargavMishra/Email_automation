import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../logger.js';

const SMTP_TIMEOUT_MS = 20000;

function createTransport() {
  if (!env.SMTP_HOST) {
    return null;
  }

  const isBrevo = env.SMTP_HOST.toLowerCase().includes('brevo.com');
  const shouldRequireTls = env.SMTP_REQUIRE_TLS || isBrevo;
  const authEnabled = Boolean(env.SMTP_USER);

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    requireTLS: shouldRequireTls,
    pool: env.SMTP_POOL,
    maxConnections: env.SMTP_MAX_CONNECTIONS,
    maxMessages: env.SMTP_MAX_MESSAGES,
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
    tls: {
      minVersion: 'TLSv1.2',
      servername: env.SMTP_HOST
    },
    auth: authEnabled
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

  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('SMTP send timeout exceeded.')), SMTP_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      transport.sendMail({
        from: env.EMAIL_FROM,
        ...message
      }),
      timeoutPromise
    ]);
  } catch (error) {
    logger.error('Failed to send email.', {
      to: message.to,
      subject: message.subject,
      error: error.message,
      provider: env.EMAIL_PROVIDER,
      host: env.SMTP_HOST
    });
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function sendWelcomeEmail(user) {
  return sendMail({
    to: user.email,
    subject: 'Welcome to Studio Delivery Console',
    text: `Hi ${user.name ?? 'there'}, welcome to Studio Delivery Console.`,
    html: `<p>Hi ${user.name ?? 'there'},</p><p>Welcome to Studio Delivery Console.</p>`
  });
}

export async function sendPasswordResetEmail(user, token) {
  const url = `${env.CLIENT_URL}/reset-password?token=${encodeURIComponent(token)}`;

  return sendMail({
    to: user.email,
    subject: 'Reset your Studio Delivery Console password',
    text: `Reset your password: ${url}`,
    html: `<p>Use this link to reset your password. It expires in ${env.PASSWORD_RESET_TTL_MINUTES} minutes.</p><p><a href="${url}">Reset password</a></p>`
  });
}
