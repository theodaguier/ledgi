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

- **Email:** `admin@example.com`
- **Password:** `StrongPassword123!`

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

A `Dockerfile` and `docker-compose.yml` are included for easy self-hosting.

```bash
# Build and run
docker compose up -d

# The app will be available at http://localhost:3000
```

For production, use a PostgreSQL container or a managed database service (e.g., Supabase, Neon, Railway).

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
