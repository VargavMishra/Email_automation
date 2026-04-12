import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { sendPasswordResetEmail, sendWelcomeEmail } from '../../services/email.service.js';
import { AppError } from '../../utils/AppError.js';
import { createOpaqueToken, hashToken } from '../../utils/security.js';

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
  subscription: true
};

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

export function signAccessToken(user) {
  return jwt.sign(
    { email: user.email, role: user.role },
    env.JWT_ACCESS_SECRET,
    {
      subject: user.id,
      expiresIn: env.JWT_ACCESS_TTL
    }
  );
}

export function signRefreshToken(user) {
  return jwt.sign(
    { tokenType: 'refresh' },
    env.JWT_REFRESH_SECRET,
    {
      subject: user.id,
      expiresIn: env.JWT_REFRESH_TTL
    }
  );
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

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name,
      passwordHash,
      subscription: {
        create: {
          plan: 'FREE',
          status: 'ACTIVE',
          provider: 'MOCK'
        }
      }
    },
    select: publicUserSelect
  });

  await sendWelcomeEmail(user);
  const tokens = await issueTokenPair(user);

  return { user, tokens };
}

export async function login({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
    include: { subscription: true }
  });

  if (!user?.passwordHash) {
    throw new AppError('Invalid email or password', 401);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AppError('Invalid email or password', 401);
  }

  const tokens = await issueTokenPair(user);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      subscription: user.subscription
    },
    tokens
  };
}

export async function refresh(refreshToken) {
  if (!refreshToken) {
    throw new AppError('Refresh token is required', 400);
  }

  let payload;
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
  } catch {
    throw new AppError('Invalid refresh token', 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { subscription: true }
  });

  if (!user?.refreshTokenHash || user.refreshTokenHash !== hashToken(refreshToken)) {
    throw new AppError('Invalid refresh token', 401);
  }

  const tokens = await issueTokenPair(user);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      subscription: user.subscription
    },
    tokens
  };
}

export async function logout(refreshToken) {
  if (!refreshToken) {
    return { ok: true };
  }

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

  if (!user) {
    return { ok: true };
  }

  const token = createOpaqueToken();
  const resetTokenExpiresAt = new Date(Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetTokenHash: hashToken(token),
      resetTokenExpiresAt
    }
  });

  await sendPasswordResetEmail(user, token);

  return { ok: true };
}

export async function resetPassword({ token, password }) {
  const user = await prisma.user.findFirst({
    where: {
      resetTokenHash: hashToken(token),
      resetTokenExpiresAt: {
        gt: new Date()
      }
    }
  });

  if (!user) {
    throw new AppError('Reset token is invalid or expired', 400);
  }

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

  if (!email) {
    throw new AppError('Google profile does not include an email address', 400);
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { googleId: profile.id },
        { email }
      ]
    },
    include: { subscription: true }
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
      emailVerifiedAt: new Date(),
      subscription: {
        create: {
          plan: 'FREE',
          status: 'ACTIVE',
          provider: 'MOCK'
        }
      }
    },
    include: { subscription: true }
  });
}

export async function completeOAuthLogin(user) {
  return issueTokenPair(user);
}
