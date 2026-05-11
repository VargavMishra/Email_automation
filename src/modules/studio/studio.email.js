import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';

const SMTP_TIMEOUT_MS = 20000;

function createTransport() {
  if (env.EMAIL_PROVIDER === 'gmail') {
    if (!env.GMAIL_USER || !env.GMAIL_CLIENT_ID || !env.GMAIL_CLIENT_SECRET || !env.GMAIL_REFRESH_TOKEN) {
      return null;
    }

    return nodemailer.createTransport({
      service: 'gmail',
      connectionTimeout: SMTP_TIMEOUT_MS,
      greetingTimeout: SMTP_TIMEOUT_MS,
      socketTimeout: SMTP_TIMEOUT_MS,
      auth: {
        type: 'OAuth2',
        user: env.GMAIL_USER,
        clientId: env.GMAIL_CLIENT_ID,
        clientSecret: env.GMAIL_CLIENT_SECRET,
        refreshToken: env.GMAIL_REFRESH_TOKEN,
        accessToken: env.GMAIL_ACCESS_TOKEN || undefined
      }
    });
  }

  if (!env.SMTP_HOST) {
    return null;
  }

  const isBrevo = env.SMTP_HOST.toLowerCase().includes('brevo.com');
  const shouldRequireTls = env.SMTP_REQUIRE_TLS || isBrevo;
  const authEnabled = Boolean(env.SMTP_USER);

  if (authEnabled && !env.SMTP_PASS) {
    throw new AppError('SMTP_PASS is required when SMTP_USER is configured.', 503);
  }

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

async function sendViaResend(message) {
  if (!env.RESEND_API_KEY) {
    throw new AppError('RESEND_API_KEY is required when EMAIL_PROVIDER=resend.', 503);
  }

  const response = await fetch(env.RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: Array.isArray(message.to) ? message.to : [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
      headers: message.headers
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new AppError(`Resend API error: ${body}`, response.status);
  }

  const result = await response.json();

  return {
    provider: 'resend',
    messageId: result.id,
    response: result
  };
}

export async function sendStudioEmail(message) {
  if (env.EMAIL_PROVIDER === 'resend') {
    return sendViaResend(message);
  }

  if (!transport) {
    throw new AppError('SMTP or Gmail email transport is not configured.', 503);
  }

  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new AppError('SMTP send timeout exceeded.', 504)), SMTP_TIMEOUT_MS);
  });

  try {
    const info = await Promise.race([
      transport.sendMail({
        from: env.EMAIL_FROM,
        ...message
      }),
      timeoutPromise
    ]);

    clearTimeout(timeoutId);

    return {
      provider: env.EMAIL_PROVIDER,
      messageId: info.messageId,
      response: info.response
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(`SMTP send failed: ${error.message}`, 502, {
      provider: env.EMAIL_PROVIDER,
      host: env.SMTP_HOST
    });
  }
}
