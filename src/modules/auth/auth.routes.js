import { Router } from 'express';
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

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production'
  };
}

/**
 * @openapi
 * /api/auth/signup:
 *   post:
 *     summary: Create a user account
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 */
authRouter.post('/signup', validate(signupSchema), asyncHandler(async (req, res) => {
  const result = await signup(req.validated.body);
  res.cookie('refreshToken', result.tokens.refreshToken, cookieOptions());
  res.status(201).json(result);
}));



/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 */
authRouter.post('/login', validate(loginSchema), asyncHandler(async (req, res) => { 
  const result = await login(req.validated.body);
  res.cookie('refreshToken', result.tokens.refreshToken, cookieOptions());
  res.json(result);
}));

/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed
 */
authRouter.post('/refresh', validate(refreshSchema), asyncHandler(async (req, res) => {
  const token = req.validated.body.refreshToken ?? req.cookies.refreshToken;
  const result = await refresh(token);
  res.cookie('refreshToken', result.tokens.refreshToken, cookieOptions());
  res.json(result);
}));

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags:
 *       - Auth
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
authRouter.post('/logout', asyncHandler(async (req, res) => {
  await logout(req.body.refreshToken ?? req.cookies.refreshToken);
  res.clearCookie('refreshToken');
  res.json({ ok: true });
}));


/**
 * @openapi
 * /api/auth/forgot-password:
 *   post:
 *     summary: Send password reset email
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 example: test@example.com
 *     responses:
 *       200:
 *         description: Email sent
 */
authRouter.post('/forgot-password', validate(forgotPasswordSchema), asyncHandler(async (req, res) => {
  await forgotPassword(req.validated.body.email);
  res.json({ ok: true });
}));



/**
 * @openapi
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset user password
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *                 example: newpassword123
 *     responses:
 *       200:
 *         description: Password reset successful
 */
authRouter.post('/reset-password', validate(resetPasswordSchema), asyncHandler(async (req, res) => {
  await resetPassword(req.validated.body);
  res.json({ ok: true });
}));

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Get current user
 *     tags:
 *       - Auth
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user data
 */
authRouter.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});


/**
 * @openapi
 * /api/auth/google:
 *   get:
 *     summary: Login with Google
 *     tags:
 *       - Auth
 *     responses:
 *       302:
 *         description: Redirect to Google OAuth
 */
authRouter.get('/google', (req, res, next) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return next(new AppError('Google OAuth is not configured', 503));
  }

  return passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false
  })(req, res, next);
});


/**
 * @openapi
 * /api/auth/google/callback:
 *   get:
 *     summary: Google OAuth callback
 *     tags:
 *       - Auth
 *     responses:
 *       302:
 *         description: Redirect after successful login
 */
authRouter.get('/google/callback', passport.authenticate('google', {
  failureRedirect: `${env.CLIENT_URL}/login?oauth=failed`,
  session: false
}), asyncHandler(async (req, res) => {
  const tokens = await completeOAuthLogin(req.user);
  res.cookie('refreshToken', tokens.refreshToken, cookieOptions());
  res.cookie('accessToken', tokens.accessToken, cookieOptions());
  res.json({
  message: "Google login successful",
  tokens
});
}));
