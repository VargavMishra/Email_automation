# Photo Studio Delivery Automation

Production-oriented automation system for an e-commerce photography studio. The platform watches project readiness, validates Google Drive delivery folders, sends personalized delivery emails, tracks opens and clicks, retries failures, and gives studio staff a Next.js admin dashboard for overrides.

## What Is Included

- Express API with authenticated studio admin routes
- Prisma + MongoDB data model for clients, projects, dispatch queue, logs, and activity history
- Event-driven delivery automation with reconciliation polling
- Google Drive validation hooks
- SMTP, Gmail OAuth2, or Resend delivery support
- Open/click tracking routes
- Slack and WhatsApp failure alert hooks
- Next.js + Tailwind admin dashboard scaffold
- Docker Compose and GitHub Actions CI

## Quick Start

1. Start MongoDB locally, or update `DATABASE_URL` in `.env` to a MongoDB Atlas connection string.

2. Install and prepare the backend:

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Backend URLs:

- `http://localhost:4500/health`
- `http://localhost:4500/docs`

3. Start the dashboard in a second terminal:

```bash
cd apps/dashboard
npm install
npm run dev
```

Dashboard URL:

- `http://localhost:3000/login`

## Dashboard Login

The dashboard now uses live authenticated requests instead of demo fallback data.

1. Create an admin user through the backend:

```bash
curl -X POST http://localhost:4500/api/auth/signup \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Admin\",\"email\":\"you@example.com\",\"password\":\"StrongPass123!\"}"
```

2. Open the dashboard at `http://localhost:3000/login`
3. Sign in with the same email and password
4. The dashboard will then load real `/api/studio/*` data from the backend

## Main Backend Routes

- `GET /api/studio/overview`
- `GET /api/studio/clients`
- `POST /api/studio/clients`
- `GET /api/studio/projects`
- `POST /api/studio/projects`
- `PATCH /api/studio/projects/:id`
- `POST /api/studio/projects/:id/manual-send`
- `GET /api/studio/logs`
- `GET /api/studio/tracking/open/:token`
- `GET /api/studio/tracking/click/:token`

## Deployment

```bash
docker compose up --build
```

## Documentation

- [Architecture, schema, API map, templates, and deployment guide](/C:/Users/Sanjay%20Mishra/Documents/New%20project/docs/photo-studio-automation.md)
