# Ledgi

**Self-hosted personal & shared expense tracker**

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-blue)](https://postgresql.org)

---

Ledgi is an open-source, self-hosted expense tracking application designed for individuals, couples, and families. Import your bank statements, categorize transactions automatically, and get a clear picture of your finances — all under your control, on your own server.

## Features

- **Multi-workspace** — Personal, couple, or family spaces with role-based access (Owner, Admin, Member) and email invitations
- **Multi-account banking** — Support for checking, savings, credit cards, and investment accounts with automatic bank logos (Logo.dev)
- **CSV import** — Automatic bank statement parsing with multi-format detection and deduplication
- **Smart categorization** — Rule-based auto-categorization (exact match, contains, starts/ends with, regex, keywords) with manual label learning across similar transactions
- **Dashboard** — Visualize spending with interactive charts (Recharts), per-period and per-member filters
- **REST API** — Full CRUD API with API key management, granular scopes, and pagination
- **User profiles** — Avatar upload, change password, per-user locale (French, English, Spanish)
- **Themes** — System, light, and dark mode
- **Responsive UI** — Works on desktop and mobile

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL + Prisma 7 |
| Auth | Better Auth (email + password) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Charts | Recharts |
| Email | Resend |
| Icons | Lucide + Hugeicons |

## Getting Started

### Prerequisites

- **Node.js** 20+
- **Bun** (recommended) or npm
- **PostgreSQL** 16+

### Installation

```bash
# 1. Clone the repository
git clone git@github.com:theodaguier/finance.git
cd finance

# 2. Install dependencies
bun install

# 3. Copy and edit environment variables
cp .env.example .env
# Then edit .env with your database URL and secrets

# 4. Run database migrations
bun run db:migrate

# 5. (Optional) Seed the database with an admin user
bun run db:seed

# 6. Start the development server
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Default Admin Credentials (after seed)

- **Email:** `theo.daguier@icloud.com` (or `ADMIN_EMAIL` env var)
- **Password:** `Pokemon72000!` (or `ADMIN_PASSWORD` env var)

> ⚠️ Change these credentials immediately after first login.

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `BETTER_AUTH_SECRET` | Auth secret (min 32 chars) | ✅ |
| `BETTER_AUTH_URL` | Public app/auth URL used server-side | ✅ |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | Public app/auth URL used client-side | ✅ |
| `NEXT_PUBLIC_APP_URL` | Public app URL used in links/emails | ✅ |
| `RESEND_API_KEY` | Resend API key for sending emails (invitations, password reset) | Optional |
| `EMAIL_FROM` | From address for transactional emails | Optional |
| `LOGO_DEV_PUBLISHABLE_KEY` | Logo.dev publishable key for bank logos | Optional |
| `LOGO_DEV_SECRET_KEY` | Logo.dev secret key for bank logo search API | Optional |
| `ADMIN_NAME` | Admin display name for seeding | Optional (has defaults) |
| `ADMIN_EMAIL` | Admin email for seeding | Optional (has defaults) |
| `ADMIN_PASSWORD` | Admin password for seeding | Optional (has defaults) |
| `APP_PORT` | Host port for Docker (default `3000`) | Optional |

`POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` are only used by the optional local Docker Postgres override in `docker-compose.local-db.yml`.

> ⚠️ If you omit the `ADMIN_*` variables, the seed script uses hardcoded defaults. Change them immediately after first login.

Generate a secret with:

```bash
openssl rand -base64 32
```

## API Reference

Ledgi exposes a full REST API under `/api/v1/*` with API key authentication and granular scopes.

See the complete API documentation in [API.md](API.md) for:
- All endpoints with full parameter documentation
- Request/response schemas with examples
- Authentication, scopes, and error codes
- Advanced search, filtering, and pagination
- CSV import formats and deduplication

API key management is available in the workspace settings.

## Self-Hosting

### Docker

The `Dockerfile` uses a multi-stage build and produces two targets:

- **`runner`** — the production Next.js server (default target, use as the main container)
- **`migrator`** — a one-off container to run Prisma migrations

The default `docker-compose.yml` is app-only: it expects `DATABASE_URL` to point
to an existing PostgreSQL database. If you want a local PostgreSQL container for
development, use the optional `docker-compose.local-db.yml` override.

#### Prerequisites

- Docker 24+

#### Setup

```bash
# Prerequisites: Docker daemon must be running
# 1. Copy the environment template and fill in your values
cp .env.example .env
# Then edit .env — at minimum you need:
#   DATABASE_URL         (your existing PostgreSQL database)
#   BETTER_AUTH_SECRET   (generate with: openssl rand -base64 32)
#   BETTER_AUTH_URL
#   NEXT_PUBLIC_BETTER_AUTH_URL
#   NEXT_PUBLIC_APP_URL
# In production, the three URL values must be your public domain, not localhost.

# 2. Build the image
docker compose build

# 3. Run database migrations (one-off, optional if you rely on container startup)
docker compose --profile migrate run migrator

# 4. Start the app
docker compose up -d

# The app will be available at http://localhost:3000
```

The production `runner` image also executes `prisma migrate deploy` before
starting Next.js. This makes Dockerfile-based platforms such as Dockploy apply
pending Prisma migrations automatically on each deploy.

#### Optional local PostgreSQL

If you want Docker to run a local PostgreSQL container for development, use the
compose override file. It injects a local `db` service and rewires `DATABASE_URL`
for `app` and `migrator` automatically.

```bash
# Optional: customize POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB in .env

# 1. Start the local database
docker compose -f docker-compose.yml -f docker-compose.local-db.yml up -d db

# 2. Run migrations against the local database
docker compose -f docker-compose.yml -f docker-compose.local-db.yml --profile migrate run migrator

# 3. Start the app
docker compose -f docker-compose.yml -f docker-compose.local-db.yml up -d
```

#### Persisting avatars

Avatar images are stored on disk at `public/uploads/avatars`. The compose file
mounts a named volume so they survive container restarts:

```yaml
volumes:
  - ledgi_uploads:/app/public/uploads
```

If you use `docker-compose.local-db.yml`, PostgreSQL data is stored in the
`ledgi_pgdata` named volume.

#### Updating after code changes

```bash
docker compose build
docker compose up -d
```

If you are using the optional local PostgreSQL override, add
`-f docker-compose.yml -f docker-compose.local-db.yml` to each command.

#### Database schema changes

After modifying `prisma/schema.prisma`, rebuild and redeploy. The app container
will apply pending migrations automatically on startup. You can still run the
dedicated `migrator` service manually if you prefer an explicit migration step:

```bash
docker compose build
docker compose up -d
```

For production, point `DATABASE_URL` at your existing PostgreSQL service.

### Vercel

The app can deploy to Vercel, but note that avatar uploads are stored on the local filesystem (`public/uploads/avatars`). Vercel's ephemeral filesystem means uploads will not persist across deploys. For production use, prefer Docker or a platform with persistent storage.

### Other Platforms

Ledgi is a standard Next.js application. It can be deployed to any platform supporting Node.js with persistent storage (Railway, Render, Fly.io, etc.) and a PostgreSQL database.

## Database Commands

```bash
# Development
bun run db:generate    # Generate Prisma client
bun run db:migrate     # Create & apply a new migration (dev only)
bun run db:push        # Push schema changes without migration (dev)
bun run db:seed        # Seed the database
bun run db:studio      # Open Prisma Studio
bun run db:reset       # Reset the database

# Production (outside Docker)
npx prisma migrate deploy   # Apply pending migrations in production
```

In Docker, the `migrator` container runs `prisma migrate deploy` automatically.

## Contributing

Contributions are welcome.

```bash
# 1. Fork the repository
# 2. Create a feature branch
git checkout -b feat/my-feature

# 3. Commit your changes
git commit -m "feat: add my feature"

# 4. Push and open a Pull Request
git push origin feat/my-feature
```

Before committing, run the linter:

```bash
bun run lint
```

## License

MIT © 2025 [theodaguier](https://github.com/theodaguier)
