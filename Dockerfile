# ============================================================
# Stage 1 — Install dependencies
# ============================================================
FROM oven/bun:1-debian AS deps

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --ci

# ============================================================
# Stage 2 — Generate Prisma client
# ============================================================
FROM deps AS prisma

WORKDIR /app

# prisma.config.ts must be at project root for Prisma 7 to resolve schema/migrations
# paths correctly ("prisma/schema.prisma", "prisma/migrations").
# Then copy the whole prisma/ directory so the schema and migrations are in place.
COPY prisma.config.ts .
COPY prisma/ ./prisma/

RUN bunx prisma generate

# ============================================================
# Stage 3 — Build the Next.js application
# ============================================================
FROM deps AS builder

WORKDIR /app

ARG NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000

ENV NEXT_PUBLIC_BETTER_AUTH_URL=${NEXT_PUBLIC_BETTER_AUTH_URL}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

# Build-time placeholders for mandatory services. Real values are provided at runtime.
ENV DATABASE_URL="postgresql://buildtime:placeholder@localhost/placeholder"
ENV BETTER_AUTH_SECRET="buildtime-placeholder-secret-min-32-chars!!"
ENV RESEND_API_KEY="re_placeholder_buildtime_only_not_real"
ENV EMAIL_FROM="buildtime@placeholder.local"

# Copy prisma generated client first, then all source files
COPY --from=prisma /app/node_modules /app/node_modules
COPY . .

RUN NEXT_MANUAL_SIG_HANDLE=true bun run build

# ============================================================
# Stage 4 — Production runtime (runner)
# ============================================================
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN groupadd --gid 1001 --system appgroup && \
    useradd --uid 1001 --gid 1001 --system --shell /bin/false appuser

# Install dumb-init for PID 1 signal handling and wget for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
        dumb-init \
        wget \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static   .next/static
COPY --from=builder /app/public        ./public
COPY --from=builder /app/prisma        ./prisma

RUN mkdir -p public/uploads/avatars && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3000/api/v1/health || exit 1

CMD ["node", "server.js"]

# ============================================================
# Stage 5 — One-off migrator
# Run with: docker compose --profile migrate run migrator
# ============================================================
FROM oven/bun:1-debian AS migrator

WORKDIR /app

ENV NODE_ENV=production

RUN groupadd --gid 1001 --system appgroup && \
    useradd --uid 1001 --gid 1001 --system --shell /bin/false appuser && \
    apt-get update && apt-get install -y --no-install-recommends dumb-init && \
    rm -rf /var/lib/apt/lists/*

# node_modules contains @prisma/engines which needs to be writable at runtime
# for `prisma migrate deploy`. We fix ownership after copying.
COPY --from=builder /app/node_modules          /app/node_modules
COPY --from=builder /app/prisma                /app/prisma
COPY --from=builder /app/prisma.config.ts      /app/prisma.config.ts
COPY --from=builder /app/.env.example          /app/.env

RUN chown -R appuser:appgroup /app/node_modules /app/prisma && \
    chown appuser:appgroup /app

USER appuser

ENTRYPOINT ["dumb-init", "--"]
CMD ["bunx", "prisma", "migrate", "deploy"]
