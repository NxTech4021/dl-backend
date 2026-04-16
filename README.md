# DeuceLeague Backend

REST API for the DeuceLeague platform. Handles authentication, leagues, seasons, matches, payments, notifications, and admin operations.

**Stack:** Node.js + TypeScript + Express + Prisma + PostgreSQL + better-auth

## Prerequisites

- Node.js 20+
- PostgreSQL 14+
- npm or yarn
- (Optional) Docker for containerized local dev

## Setup

```bash
# Install dependencies
yarn install

# Configure environment
cp .env.example .env
# Fill in database URL, auth secrets, OAuth credentials, etc.

# Generate Prisma client
yarn db:generate

# Run migrations
yarn db:migrate

# (Optional) Seed the database
yarn db:seed

# Start dev server (default: http://localhost:3000)
yarn dev
```

## Scripts

| Command | Purpose |
|---------|---------|
| `yarn dev` | Start dev server with hot reload (`tsx watch`) |
| `yarn build` | Compile TypeScript to `dist/` |
| `yarn start` | Run compiled production server |
| `yarn db:migrate` | Run Prisma migrations (dev) |
| `yarn db:generate` | Regenerate Prisma client |
| `yarn db:seed` | Seed database |
| `yarn seed:superadmin` | Create superadmin user |
| `yarn lint` | Run ESLint |
| `yarn test` | Run Jest tests |

## Environment Variables

See [.env.example](.env.example) for the full list and documentation. Key categories:

- **Server**: `PORT`, `NODE_ENV`, `BASE_URL`
- **Database**: `DATABASE_URL`
- **Auth**: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
- **OAuth**: Google, Facebook, Apple credentials
- **External services**: Payment gateway, GCS, email, etc.

Generate secrets with:
```bash
openssl rand -hex 32
```

## Database

- Schema: [prisma/schema.prisma](prisma/schema.prisma)
- Migrations: `prisma/migrations/`
- Seeds: `prisma/seeds/`

When pulling changes that include schema updates:
```bash
yarn db:generate && yarn db:migrate
```

## Docker

```bash
docker build -t dl-backend .
docker run -p 3000:3000 --env-file .env dl-backend
```

## Deployment

1. Provision PostgreSQL and set `DATABASE_URL`
2. Set all secrets in `.env` (generate fresh `BETTER_AUTH_SECRET` per environment)
3. Run migrations: `yarn db:migrate deploy`
4. Build and run: `yarn build && yarn start`

## Project Structure

```
src/
├── controllers/  # Route handlers
├── services/     # Business logic
├── routes/       # Express routers
├── middleware/   # Auth, validation, error handling
├── lib/          # Shared utilities
├── types/        # TypeScript types
└── server.ts     # Entry point

prisma/
├── schema.prisma
├── migrations/
└── seeds/
```
