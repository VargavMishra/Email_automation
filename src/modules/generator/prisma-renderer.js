import { camelCase, indent } from './name-utils.js';

const prismaTypeMap = {
  String: 'String',
  Int: 'Int',
  Float: 'Float',
  Boolean: 'Boolean',
  DateTime: 'DateTime',
  Json: 'Json'
};

function fieldLine(field) {
  const optional = field.required ? '' : '?';
  const unique = field.unique ? ' @unique' : '';
  const defaultValue = field.default === undefined ? '' : ` @default(${JSON.stringify(field.default)})`;
  return `${field.name} ${prismaTypeMap[field.type]}${optional}${unique}${defaultValue}`;
}

function renderCrudModel(entity) {
  const fields = entity.fields.map(fieldLine).join('\n');

  return `model ${entity.name} {
  id        String   @id @default(cuid())
${indent(fields, 2)}
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}`;
}

export function renderPrismaSchema({ features, crudEntities = [] }) {
  const needsAuth = features.auth || features.rbac || features.payments || features.subscriptions || features.email;
  const needsSubscription = features.subscriptions || features.payments;
  const needsPayment = features.payments;
  const needsProject = features.apiGenerator;

  const enums = [];
  if (needsAuth) {
    enums.push(`enum Role {
  ADMIN
  USER
}`);
  }

  if (needsSubscription || needsPayment) {
    enums.push(`enum Plan {
  FREE
  PRO
}

enum SubscriptionStatus {
  ACTIVE
  CANCELED
  PAST_DUE
}

enum PaymentProvider {
  RAZORPAY
  MOCK
}`);
  }

  if (needsPayment) {
    enums.push(`enum PaymentStatus {
  CREATED
  PAID
  FAILED
  REFUNDED
}`);
  }

  const models = [];
  if (needsAuth) {
    const relationFields = [
      needsSubscription ? '  subscription           Subscription?' : '',
      needsPayment ? '  payments               Payment[]' : '',
      needsProject ? '  projects               Project[]' : ''
    ].filter(Boolean).join('\n');

    models.push(`model User {
  id                     String        @id @default(cuid())
  email                  String        @unique
  name                   String?
  passwordHash           String?
  role                   Role          @default(USER)
  googleId               String?       @unique
  refreshTokenHash       String?
  resetTokenHash         String?
  resetTokenExpiresAt    DateTime?
  emailVerifiedAt        DateTime?
  createdAt              DateTime      @default(now())
  updatedAt              DateTime      @updatedAt
${relationFields}
}`);
  }

  if (needsSubscription) {
    models.push(`model Subscription {
  id                 String             @id @default(cuid())
  userId             String             @unique
  plan               Plan               @default(FREE)
  status             SubscriptionStatus @default(ACTIVE)
  currentPeriodStart DateTime           @default(now())
  currentPeriodEnd   DateTime?
  provider           PaymentProvider    @default(MOCK)
  providerCustomerId String?
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt
  user               User               @relation(fields: [userId], references: [id], onDelete: Cascade)
}`);
  }

  if (needsPayment) {
    models.push(`model Payment {
  id                String          @id @default(cuid())
  userId            String
  provider          PaymentProvider
  status            PaymentStatus   @default(CREATED)
  plan              Plan
  amount            Int
  currency          String          @default("INR")
  providerOrderId   String?
  providerPaymentId String?
  providerSignature String?
  metadata          Json?
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  user              User            @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([providerOrderId])
}`);
  }

  if (needsProject) {
    const userFields = needsAuth
      ? `  userId        String?
  user          User?    @relation(fields: [userId], references: [id], onDelete: SetNull)`
      : '';
    const projectIndexes = needsAuth ? '\n\n  @@index([userId])' : '';

    models.push(`model Project {
  id            String   @id @default(cuid())
  name          String
  slug          String
  schema        Json
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
${userFields}${projectIndexes}
}`);
  }

  for (const entity of crudEntities) {
    models.push(renderCrudModel({
      ...entity,
      route: entity.route ?? camelCase(entity.name)
    }));
  }

  return `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

${[...enums, ...models].join('\n\n')}
`;
}
