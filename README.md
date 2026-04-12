# SaaS Backend Boilerplate Generator

This repo contains a JavaScript Node.js/Express generator service that creates production-ready SaaS backend projects as downloadable ZIP files.

## What It Generates

- Express API with secure defaults
- PostgreSQL + Prisma
- JWT auth, refresh tokens, Google OAuth, and reset-password email
- Role-based access control
- Razorpay or mock payments
- Free and Pro subscription plans
- Dynamic CRUD APIs with Zod validation
- Swagger docs, Winston logging, rate limiting, Docker, and environment files

## Local Setup

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev
```

The API runs on `http://localhost:4000` and Swagger docs are available at `/docs`.

## CLI

```bash
npx saas-builder create-app
```

The CLI uses the same generator engine as the API.

## Main API

- `GET /api/features`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/generate`
- `POST /api/projects`
- `GET /api/projects/:id/download`
- `POST /api/payments/orders`
- `POST /api/payments/verify`
- `POST /api/payments/mock/success`
- `PATCH /api/payments/subscription`

Generation and project download routes require a valid access token.
