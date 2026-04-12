export function renderEmailFiles() {
  return {
    'src/services/email.service.js': `import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../logger.js';

function createTransport() {
  if (!env.SMTP_HOST) return null;

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined
  });
}

const transport = createTransport();

async function sendMail(message) {
  if (!transport) {
    logger.warn('SMTP is not configured; email skipped.', { to: message.to, subject: message.subject });
    return { skipped: true };
  }

  return transport.sendMail({ from: env.EMAIL_FROM, ...message });
}

export function sendWelcomeEmail(user) {
  return sendMail({
    to: user.email,
    subject: 'Welcome',
    text: \`Hi \${user.name ?? 'there'}, welcome.\`
  });
}

export function sendPasswordResetEmail(user, token) {
  const url = \`\${env.CLIENT_URL}/reset-password?token=\${encodeURIComponent(token)}\`;

  return sendMail({
    to: user.email,
    subject: 'Reset your password',
    text: \`Reset your password: \${url}\`
  });
}
`
  };
}

export function renderAuthFiles(features) {
  const hasSubscription = features.subscriptions || features.payments;
  const emailImport = features.email
    ? "import { sendPasswordResetEmail, sendWelcomeEmail } from '../../services/email.service.js';\n"
    : '';
  const welcomeCall = features.email ? '  await sendWelcomeEmail(user);\n' : '';
  const resetEmailCall = features.email ? '  await sendPasswordResetEmail(user, token);\n' : '';
  const subscriptionCreate = hasSubscription
    ? `      subscription: {
        create: {
          plan: 'FREE',
          status: 'ACTIVE',
          provider: 'MOCK'
        }
      }`
    : '';
  const createComma = subscriptionCreate ? ',' : '';
  const includeSubscription = hasSubscription ? 'include: { subscription: true }' : '';
  const selectSubscription = hasSubscription ? '  subscription: true,' : '';

  return {
    'src/modules/auth/auth.schemas.js': `import { z } from 'zod';

const password = z.string().min(8).max(128);

export const signupSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password,
    name: z.string().min(1).max(120).optional()
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1)
  })
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(20).optional()
  })
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email()
  })
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(20),
    password
  })
});
`,
    'src/modules/auth/auth.service.js': `import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
${emailImport}import { AppError } from '../../utils/AppError.js';
import { createOpaqueToken, hashToken } from '../../utils/security.js';

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
${selectSubscription}
};

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function signAccessToken(user) {
  return jwt.sign({ email: user.email, role: user.role }, env.JWT_ACCESS_SECRET, {
    subject: user.id,
    expiresIn: env.JWT_ACCESS_TTL
  });
}

function signRefreshToken(user) {
  return jwt.sign({ tokenType: 'refresh' }, env.JWT_REFRESH_SECRET, {
    subject: user.id,
    expiresIn: env.JWT_REFRESH_TTL
  });
}

async function issueTokenPair(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshTokenHash: hashToken(refreshToken) }
  });

  return { accessToken, refreshToken };
}

export async function signup({ email, password, name }) {
  const normalizedEmail = normalizeEmail(email);
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (existing) {
    throw new AppError('Email is already registered', 409);
  }

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name,
      passwordHash: await bcrypt.hash(password, 12)${createComma}
${subscriptionCreate}
    },
    select: publicUserSelect
  });

${welcomeCall}  const tokens = await issueTokenPair(user);
  return { user, tokens };
}

export async function login({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
    ${includeSubscription}
  });

  if (!user?.passwordHash) {
    throw new AppError('Invalid email or password', 401);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AppError('Invalid email or password', 401);
  }

  const tokens = await issueTokenPair(user);
  return { user, tokens };
}

export async function refresh(refreshToken) {
  if (!refreshToken) throw new AppError('Refresh token is required', 400);

  let payload;
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
  } catch {
    throw new AppError('Invalid refresh token', 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    ${includeSubscription}
  });

  if (!user?.refreshTokenHash || user.refreshTokenHash !== hashToken(refreshToken)) {
    throw new AppError('Invalid refresh token', 401);
  }

  const tokens = await issueTokenPair(user);
  return { user, tokens };
}

export async function logout(refreshToken) {
  if (!refreshToken) return { ok: true };

  try {
    const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
    await prisma.user.update({
      where: { id: payload.sub },
      data: { refreshTokenHash: null }
    });
  } catch {
    return { ok: true };
  }

  return { ok: true };
}

export async function forgotPassword(email) {
  const user = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
  if (!user) return { ok: true };

  const token = createOpaqueToken();
  const resetTokenExpiresAt = new Date(Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetTokenHash: hashToken(token),
      resetTokenExpiresAt
    }
  });

${resetEmailCall}  return { ok: true };
}

export async function resetPassword({ token, password }) {
  const user = await prisma.user.findFirst({
    where: {
      resetTokenHash: hashToken(token),
      resetTokenExpiresAt: { gt: new Date() }
    }
  });

  if (!user) throw new AppError('Reset token is invalid or expired', 400);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(password, 12),
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      refreshTokenHash: null
    }
  });

  return { ok: true };
}

export async function findOrCreateGoogleUser(profile) {
  const email = normalizeEmail(profile.emails?.[0]?.value ?? '');
  if (!email) throw new AppError('Google profile does not include an email address', 400);

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ googleId: profile.id }, { email }]
    },
    ${includeSubscription}
  });

  if (existing) {
    if (!existing.googleId) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { googleId: profile.id, emailVerifiedAt: new Date() }
      });
    }

    return existing;
  }

  return prisma.user.create({
    data: {
      email,
      googleId: profile.id,
      name: profile.displayName,
      emailVerifiedAt: new Date()${createComma}
${subscriptionCreate}
    },
    ${includeSubscription}
  });
}

export function completeOAuthLogin(user) {
  return issueTokenPair(user);
}
`,
    'src/modules/auth/passport.js': `import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { env } from '../../config/env.js';
import { findOrCreateGoogleUser } from './auth.service.js';

let configured = false;

export function configurePassport() {
  if (configured) return passport;

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL
    }, async (_accessToken, _refreshToken, profile, done) => {
      try {
        done(null, await findOrCreateGoogleUser(profile));
      } catch (error) {
        done(error);
      }
    }));
  }

  configured = true;
  return passport;
}
`,
    'src/modules/auth/auth.routes.js': `import { Router } from 'express';
import passport from 'passport';
import { env } from '../../config/env.js';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { AppError } from '../../utils/AppError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  completeOAuthLogin,
  forgotPassword,
  login,
  logout,
  refresh,
  resetPassword,
  signup
} from './auth.service.js';
import {
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  resetPasswordSchema,
  signupSchema
} from './auth.schemas.js';
import { configurePassport } from './passport.js';

export const authRouter = Router();
configurePassport();
authRouter.use(passport.initialize());

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production'
  };
}

authRouter.post('/signup', validate(signupSchema), asyncHandler(async (req, res) => {
  const result = await signup(req.validated.body);
  res.cookie('refreshToken', result.tokens.refreshToken, cookieOptions());
  res.status(201).json(result);
}));

authRouter.post('/login', validate(loginSchema), asyncHandler(async (req, res) => {
  const result = await login(req.validated.body);
  res.cookie('refreshToken', result.tokens.refreshToken, cookieOptions());
  res.json(result);
}));

authRouter.post('/refresh', validate(refreshSchema), asyncHandler(async (req, res) => {
  const result = await refresh(req.validated.body.refreshToken ?? req.cookies.refreshToken);
  res.cookie('refreshToken', result.tokens.refreshToken, cookieOptions());
  res.json(result);
}));

authRouter.post('/logout', asyncHandler(async (req, res) => {
  await logout(req.body.refreshToken ?? req.cookies.refreshToken);
  res.clearCookie('refreshToken');
  res.json({ ok: true });
}));

authRouter.post('/forgot-password', validate(forgotPasswordSchema), asyncHandler(async (req, res) => {
  await forgotPassword(req.validated.body.email);
  res.json({ ok: true });
}));

authRouter.post('/reset-password', validate(resetPasswordSchema), asyncHandler(async (req, res) => {
  await resetPassword(req.validated.body);
  res.json({ ok: true });
}));

authRouter.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

authRouter.get('/google', (req, res, next) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return next(new AppError('Google OAuth is not configured', 503));
  }

  return passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next);
});

authRouter.get('/google/callback', passport.authenticate('google', {
  failureRedirect: \`\${env.CLIENT_URL}/login?oauth=failed\`,
  session: false
}), asyncHandler(async (req, res) => {
  const tokens = await completeOAuthLogin(req.user);
  res.cookie('refreshToken', tokens.refreshToken, cookieOptions());
  res.cookie('accessToken', tokens.accessToken, cookieOptions());
  res.redirect(\`\${env.CLIENT_URL}/auth/callback?oauth=success\`);
}));
`
  };
}
