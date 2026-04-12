export const featureCatalog = {
  auth: {
    label: 'Authentication',
    description: 'JWT signup/login, refresh tokens, Google OAuth, forgot/reset password, and welcome emails.',
    dependencies: ['bcryptjs', 'jsonwebtoken', 'passport', 'passport-google-oauth20', 'nodemailer'],
    env: ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'SMTP_HOST']
  },
  rbac: {
    label: 'Role-Based Access Control',
    description: 'Admin/User roles with route middleware.',
    dependencies: ['jsonwebtoken'],
    env: []
  },
  payments: {
    label: 'Payments',
    description: 'Razorpay order creation and signature verification, or mock payment flow.',
    dependencies: ['razorpay'],
    env: ['PAYMENT_PROVIDER', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET']
  },
  subscriptions: {
    label: 'Subscriptions',
    description: 'Free/Pro plan management with plan-based access guards.',
    dependencies: [],
    env: ['PAYMENT_PROVIDER']
  },
  apiGenerator: {
    label: 'CRUD API Generator',
    description: 'Dynamic Prisma models, Zod validators, controllers, services, routes, and Swagger docs.',
    dependencies: ['zod'],
    env: []
  },
  email: {
    label: 'Email Service',
    description: 'Nodemailer welcome and reset password emails.',
    dependencies: ['nodemailer'],
    env: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM']
  },
  docker: {
    label: 'Docker',
    description: 'Dockerfile and docker-compose for API and PostgreSQL.',
    dependencies: [],
    env: []
  },
  swagger: {
    label: 'Swagger API Docs',
    description: 'OpenAPI docs served from /docs.',
    dependencies: ['swagger-jsdoc', 'swagger-ui-express'],
    env: []
  },
  logging: {
    label: 'Logging',
    description: 'Winston structured logging and HTTP request logging.',
    dependencies: ['winston', 'morgan'],
    env: ['LOG_LEVEL']
  },
  rateLimit: {
    label: 'Rate Limiting',
    description: 'Global Express rate limiting.',
    dependencies: ['express-rate-limit'],
    env: ['RATE_LIMIT_WINDOW_MS', 'RATE_LIMIT_MAX']
  }
};

export const defaultFeatureSelection = {
  auth: true,
  rbac: true,
  payments: true,
  subscriptions: true,
  apiGenerator: true,
  email: true,
  docker: true,
  swagger: true,
  logging: true,
  rateLimit: true
};

export function normalizeFeatures(features = {}) {
  return {
    ...defaultFeatureSelection,
    ...features
  };
}
