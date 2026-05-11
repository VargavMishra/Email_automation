import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const booleanFromString = (defaultValue = false) =>
  z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => {
      if (value === undefined) {
        return defaultValue;
      }

      return value === true || value === 'true';
    });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().default('mongodb://localhost:27017/photo_studio_automation'),
  APP_URL: z.string().url().default('http://localhost:4000'),
  CLIENT_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  JWT_ACCESS_SECRET: z.string().min(16).default('development-access-secret-change-me'),
  JWT_REFRESH_SECRET: z.string().min(16).default('development-refresh-secret-change-me'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_CALLBACK_URL: z.string().url().default('http://localhost:4000/api/auth/google/callback'),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: booleanFromString(),
  SMTP_REQUIRE_TLS: booleanFromString(),
  SMTP_POOL: booleanFromString(true),
  SMTP_MAX_CONNECTIONS: z.coerce.number().int().positive().default(3),
  SMTP_MAX_MESSAGES: z.coerce.number().int().positive().default(100),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  EMAIL_PROVIDER: z.enum(['smtp', 'gmail', 'resend']).default('smtp'),
  EMAIL_FROM: z.string().default('SaaS Builder <no-reply@example.com>'),
  RESEND_API_KEY: z.string().optional().default(''),
  RESEND_API_URL: z.string().url().default('https://api.resend.com/emails'),
  GMAIL_USER: z.string().optional().default(''),
  GMAIL_CLIENT_ID: z.string().optional().default(''),
  GMAIL_CLIENT_SECRET: z.string().optional().default(''),
  GMAIL_REFRESH_TOKEN: z.string().optional().default(''),
  GMAIL_ACCESS_TOKEN: z.string().optional().default(''),
  PAYMENT_PROVIDER: z.enum(['razorpay', 'mock']).default('mock'),
  RAZORPAY_KEY_ID: z.string().optional().default(''),
  RAZORPAY_KEY_SECRET: z.string().optional().default(''),
  STUDIO_AUTOMATION_ENABLED: booleanFromString(true),
  STUDIO_RECONCILE_INTERVAL_MS: z.coerce.number().int().positive().default(15000),
  STUDIO_WORKER_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  STUDIO_DELIVERY_BATCH_SIZE: z.coerce.number().int().positive().default(25),
  STUDIO_DELIVERY_MAX_RETRIES: z.coerce.number().int().positive().default(5),
  STUDIO_DELIVERY_RETRY_BASE_MS: z.coerce.number().int().positive().default(60000),
  STUDIO_DRIVE_VALIDATE_ON_SAVE: booleanFromString(true),
  GOOGLE_DRIVE_ACCESS_TOKEN: z.string().optional().default(''),
  GOOGLE_DRIVE_API_BASE_URL: z.string().url().default('https://www.googleapis.com/drive/v3'),
  SLACK_WEBHOOK_URL: z.string().optional().default(''),
  WHATSAPP_WEBHOOK_URL: z.string().optional().default(''),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(500),
  LOG_LEVEL: z.string().default('info')
});

export const env = envSchema.parse(process.env);

if (env.NODE_ENV === 'production') {
  const insecureSecrets = [
    env.JWT_ACCESS_SECRET,
    env.JWT_REFRESH_SECRET
  ].filter((secret) => secret.includes('development') || secret.includes('change-me'));

  if (insecureSecrets.length > 0) {
    throw new Error('Production JWT secrets must be strong random values.');
  }
}
