import { z } from 'zod';

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
