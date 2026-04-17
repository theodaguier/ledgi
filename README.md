# Ledgi

**Self-hosted personal & shared expense tracker**

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-blue)](https://postgresql.org)

---

Ledgi is an open-source, self-hosted expense tracking application designed for individuals, couples, and families. Import your bank statements, categorize transactions automatically, and get a clear picture of your finances — all under your control, on your own server.

## Features

- **Multi-workspace** — Personal, couple, or family spaces with role-based access (Owner, Admin, Member) and email invitations
- **Multi-account banking** — Support for checking, savings, credit cards, and investment accounts
- **CSV import** — Automatic bank statement parsing with format detection
- **Smart categorization** — Rule-based auto-categorization (exact match, contains, regex, keywords) with manual label learning
- **Dashboard** — Visualize spending with interactive charts (Recharts)
- **REST API** — Full CRUD API with API keys and scopes for integrations
- **Themes** — Dark and light mode
- **Responsive UI** — Works on desktop and mobile

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL + Prisma 7 |
| Auth | Better Auth |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Charts | Recharts |
| Email | Resend |
| Icons | Hugeicons |

## Getting Started

### Prerequisites

- **Node.js** 20+
- **Bun** (recommended) or npm/pnpm
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
| `BETTER_AUTH_URL` | App URL (used by Better Auth) | ✅ |
| `NEXT_PUBLIC_APP_URL` | Public app URL | ✅ |
| `RESEND_API_KEY` | Resend API key for sending emails | Optional |
| `EMAIL_FROM` | From address for transactional emails | Optional |
| `ADMIN_NAME` | Admin display name for seeding | ✅ (on first seed) |
| `ADMIN_EMAIL` | Admin email for seeding | ✅ (on first seed) |
| `ADMIN_PASSWORD` | Admin password for seeding | ✅ (on first seed) |

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

The included `docker-compose.yml` wires everything together, including a
PostgreSQL 16 container with persistent storage. For production, replace the
`db` service with a managed PostgreSQL service (e.g., Supabase, Neon, Railway).

#### Prerequisites

- Docker 24+

#### Setup

```bash
# Prerequisites: Docker daemon must be running
# 1. Copy the environment template and fill in your values
cp .env.example .env
# Then edit .env — at minimum you need:
#   BETTER_AUTH_SECRET   (generate with: openssl rand -base64 32)
#   POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
#   (or use the defaults — ledgi / changeme / ledgi)

# 2. Build the image
docker compose build

# 3. Start the database and wait for it to be healthy
docker compose up -d db
docker compose ps   # wait until db is healthy

# 4. Run database migrations (one-off)
docker compose --profile migrate run migrator

# 5. Start the app
docker compose up -d

# The app will be available at http://localhost:3000
```

#### Persisting avatars

Avatar images are stored on disk at `public/uploads/avatars`. The compose file
mounts a named volume so they survive container restarts:

```yaml
volumes:
  - ledgi_uploads:/app/public/uploads
```

#### Updating after code changes

```bash
docker compose build
docker compose --profile migrate run migrator
docker compose up -d
```

#### Database schema changes

After modifying `prisma/schema.prisma`, rebuild and re-run migrations:

```bash
docker compose build
docker compose --profile migrate run migrator
docker compose up -d
```

For production, use a managed PostgreSQL service (e.g., Supabase, Neon, Railway).

### Vercel

The app deploys directly to Vercel. Set the environment variables in the Vercel dashboard and deploy.

### Other Platforms

Ledgi is a standard Next.js application. It can be deployed to any platform supporting Node.js (Railway, Render, Fly.io, etc.) with a PostgreSQL database.

## Database Commands

```bash
bun run db:generate    # Generate Prisma client
bun run db:migrate     # Apply migrations
bun run db:push        # Push schema changes (dev)
bun run db:seed        # Seed the database
bun run db:studio      # Open Prisma Studio
bun run db:reset       # Reset the database
```

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
