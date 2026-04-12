import { featureCatalog } from '../../config/features.js';
import { camelCase, kebabCase } from './name-utils.js';

function sortedObject(value) {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

export function renderPackageJson({ packageName, description, features, paymentMode }) {
  const dependencies = {
    '@prisma/client': '^5.22.0',
    compression: '^1.7.5',
    'cookie-parser': '^1.4.7',
    cors: '^2.8.5',
    dotenv: '^16.4.7',
    express: '^4.21.2',
    helmet: '^8.0.0',
    zod: '^3.24.1'
  };

  if (features.rateLimit) dependencies['express-rate-limit'] = '^7.5.0';
  if (features.logging) {
    dependencies.morgan = '^1.10.0';
    dependencies.winston = '^3.17.0';
  }
  if (features.swagger) {
    dependencies['swagger-jsdoc'] = '^6.2.8';
    dependencies['swagger-ui-express'] = '^5.0.1';
  }
  if (features.auth) {
    dependencies.bcryptjs = '^2.4.3';
    dependencies.jsonwebtoken = '^9.0.2';
    dependencies.passport = '^0.7.0';
    dependencies['passport-google-oauth20'] = '^2.0.0';
  }
  if (features.email) dependencies.nodemailer = '^6.9.16';
  if (features.payments) dependencies.razorpay = '^2.9.5';

  return JSON.stringify({
    name: packageName,
    version: '1.0.0',
    private: true,
    description,
    type: 'module',
    scripts: {
      dev: 'node --watch src/server.js',
      start: 'node src/server.js',
      'prisma:generate': 'prisma generate',
      'prisma:migrate': 'prisma migrate dev',
      'prisma:studio': 'prisma studio'
    },
    engines: {
      node: '>=20.0.0'
    },
    dependencies: sortedObject(dependencies),
    devDependencies: {
      prisma: '^5.22.0'
    }
  }, null, 2);
}

export function renderEnv({ packageName, features, paymentMode }) {
  const lines = [
    'NODE_ENV=development',
    'PORT=4000',
    `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/${packageName.replaceAll('-', '_')}?schema=public`,
    'APP_URL=http://localhost:4000',
    'CLIENT_URL=http://localhost:3000',
    'CORS_ORIGIN=http://localhost:3000',
    'RATE_LIMIT_WINDOW_MS=900000',
    'RATE_LIMIT_MAX=200',
    'LOG_LEVEL=info'
  ];

  if (features.auth) {
    lines.push(
      'JWT_ACCESS_SECRET=replace-with-a-long-random-access-secret',
      'JWT_REFRESH_SECRET=replace-with-a-long-random-refresh-secret',
      'JWT_ACCESS_TTL=15m',
      'JWT_REFRESH_TTL=7d',
      'PASSWORD_RESET_TTL_MINUTES=30',
      'GOOGLE_CLIENT_ID=',
      'GOOGLE_CLIENT_SECRET=',
      'GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback'
    );
  }

  if (features.email) {
    lines.push(
      'SMTP_HOST=',
      'SMTP_PORT=587',
      'SMTP_SECURE=false',
      'SMTP_USER=',
      'SMTP_PASS=',
      'EMAIL_FROM="Generated SaaS <no-reply@example.com>"'
    );
  }

  if (features.payments) {
    lines.push(
      `PAYMENT_PROVIDER=${paymentMode}`,
      'RAZORPAY_KEY_ID=',
      'RAZORPAY_KEY_SECRET='
    );
  }

  return `${lines.join('\n')}\n`;
}

export function renderReadme({ projectName, features, crudEntities }) {
  const enabled = Object.entries(features)
    .filter(([, enabled]) => enabled)
    .map(([key]) => `- ${featureCatalog[key]?.label ?? key}`)
    .join('\n');
  const crud = crudEntities.length
    ? crudEntities.map((entity) => `- ${entity.name}: /api/${entity.route ?? kebabCase(entity.name)}`).join('\n')
    : '- No custom CRUD entities selected';

  return `# ${projectName}

Generated with SaaS Builder.

## Setup

\`\`\`bash
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev
\`\`\`

API: http://localhost:4000
Docs: http://localhost:4000/docs

## Enabled Features

${enabled}

## CRUD APIs

${crud}
`;
}

export function renderDockerfile() {
  return `FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN npx prisma generate

EXPOSE 4000
CMD ["npm", "start"]
`;
}

export function renderDockerCompose(packageName) {
  const database = packageName.replaceAll('-', '_');

  return `services:
  api:
    build: .
    ports:
      - "4000:4000"
    env_file:
      - .env
    depends_on:
      - postgres

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: ${database}
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  postgres-data:
`;
}

export function renderConfigEnv(features) {
  return `import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const booleanFromString = z
  .union([z.boolean(), z.string()])
  .default(false)
  .transform((value) => value === true || value === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url().default('http://localhost:4000'),
  CLIENT_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(200),
  LOG_LEVEL: z.string().default('info'),
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
  SMTP_SECURE: booleanFromString,
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  EMAIL_FROM: z.string().default('Generated SaaS <no-reply@example.com>'),
  PAYMENT_PROVIDER: z.enum(['razorpay', 'mock']).default('mock'),
  RAZORPAY_KEY_ID: z.string().optional().default(''),
  RAZORPAY_KEY_SECRET: z.string().optional().default('')
});

export const env = envSchema.parse(process.env);

if (env.NODE_ENV === 'production') {
  const insecure = [env.JWT_ACCESS_SECRET, env.JWT_REFRESH_SECRET]
    .some((secret) => secret.includes('development') || secret.includes('change-me'));

  if (${features.auth ? 'insecure' : 'false'}) {
    throw new Error('Production JWT secrets must be replaced.');
  }
}
`;
}

export function renderConfigFeatures(features) {
  return `export const features = ${JSON.stringify(features, null, 2)};
`;
}

export function renderPrismaClient() {
  return `import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error']
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
`;
}

export function renderLogger(features) {
  if (!features.logging) {
    return `export const logger = {
  info: console.log,
  warn: console.warn,
  error: console.error
};
`;
  }

  return `import winston from 'winston';
import { env } from './config/env.js';

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: env.NODE_ENV === 'development'
        ? winston.format.combine(winston.format.colorize(), winston.format.simple())
        : winston.format.json()
    })
  ]
});
`;
}

export function renderCommonFiles(features) {
  return {
    'src/utils/AppError.js': `export class AppError extends Error {
  constructor(message, statusCode = 500, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
  }
}
`,
    'src/utils/asyncHandler.js': `export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
`,
    'src/utils/security.js': `import crypto from 'node:crypto';

export function createOpaqueToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function constantTimeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
`,
    'src/middleware/validate.js': `import { AppError } from '../utils/AppError.js';

export function validate(schema) {
  return (req, _res, next) => {
    const parsed = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query
    });

    if (!parsed.success) {
      return next(new AppError('Validation failed', 400, parsed.error.flatten()));
    }

    req.validated = parsed.data;
    return next();
  };
}
`,
    'src/middleware/notFound.js': `import { AppError } from '../utils/AppError.js';

export function notFound(req, _res, next) {
  next(new AppError(\`Route not found: \${req.method} \${req.originalUrl}\`, 404));
}
`,
    'src/middleware/errorHandler.js': `import { Prisma } from '@prisma/client';
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
`
  };
}

export function renderAuthMiddleware() {
  return `import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/AppError.js';

export async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new AppError('Authentication required', 401);
    }

    const token = header.slice('Bearer '.length);
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { subscription: true }
    });

    if (!user) {
      throw new AppError('Authentication required', 401);
    }

    req.user = user;
    return next();
  } catch (error) {
    return next(error instanceof AppError ? error : new AppError('Authentication required', 401));
  }
}

export function authorize(...roles) {
  return (req, _res, next) => {
    if (!roles.includes(req.user?.role)) {
      return next(new AppError('Forbidden', 403));
    }

    return next();
  };
}

export function requirePlan(...plans) {
  return (req, _res, next) => {
    const plan = req.user?.subscription?.plan ?? 'FREE';
    const status = req.user?.subscription?.status ?? 'ACTIVE';

    if (status !== 'ACTIVE' || !plans.includes(plan)) {
      return next(new AppError('Subscription upgrade required', 402));
    }

    return next();
  };
}
`;
}

export function renderSwaggerConfig(features) {
  if (!features.swagger) return '';

  return `import swaggerJSDoc from 'swagger-jsdoc';

export const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Generated SaaS API',
      version: '1.0.0'
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  },
  apis: ['./src/**/*.routes.js']
});
`;
}

export function renderApp(features) {
  return `import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
${features.rateLimit ? "import rateLimit from 'express-rate-limit';\n" : ''}import helmet from 'helmet';
${features.logging ? "import morgan from 'morgan';\n" : ''}${features.swagger ? "import swaggerUi from 'swagger-ui-express';\nimport { swaggerSpec } from './config/swagger.js';\n" : ''}import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { logger } from './logger.js';
import { router } from './routes/index.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
${features.rateLimit ? '  app.use(rateLimit({ windowMs: env.RATE_LIMIT_WINDOW_MS, max: env.RATE_LIMIT_MAX }));\n' : ''}${features.logging ? "  app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));\n" : ''}
  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
${features.swagger ? "\n  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));\n" : ''}
  app.use('/api', router);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
`;
}

export function renderServer() {
  return `import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { logger } from './logger.js';

const app = createApp();
const server = app.listen(env.PORT, () => logger.info(\`API listening on port \${env.PORT}\`));

async function shutdown(signal) {
  logger.info(\`Received \${signal}; shutting down.\`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
`;
}

export function renderRouteIndex({ features, crudEntities }) {
  const imports = [];
  const uses = [];

  if (features.auth) {
    imports.push("import { authRouter } from '../modules/auth/auth.routes.js';");
    uses.push("router.use('/auth', authRouter);");
  }

  if (features.payments) {
    imports.push("import { paymentRouter } from '../modules/payments/payment.routes.js';");
    uses.push("router.use('/payments', paymentRouter);");
  }

  for (const entity of crudEntities) {
    imports.push(`import { ${camelCase(entity.name)}Router } from '../modules/${kebabCase(entity.name)}/${kebabCase(entity.name)}.routes.js';`);
    uses.push(`router.use('/${entity.route ?? kebabCase(entity.name)}', ${camelCase(entity.name)}Router);`);
  }

  return `import { Router } from 'express';
${imports.join('\n')}

export const router = Router();

router.get('/features', (_req, res) => {
  res.json({ features: ${JSON.stringify(features)} });
});

${uses.join('\n')}
`;
}
