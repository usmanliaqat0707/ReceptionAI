# Local Development Guide

## Prerequisites

- Node.js 20.x LTS (see `.nvmrc`)
- pnpm 11.25.0 (`corepack enable` then `corepack prepare pnpm@11.25.0 --activate`)
- Docker and Docker Compose

## Quick start

### 1. Copy environment defaults

```bash
cp .env.example .env
```

OpenAI, Google Calendar, Twilio, and Resend keys are optional. Leave them
unset to use mock embeddings, the internal demo calendar, and mock SMS/email.

### 2. Start PostgreSQL (pgvector) and Redis

```bash
pnpm db:up
```

Service mapping:

- PostgreSQL 16 with pgvector: `127.0.0.1:5433`
- Redis 7: `127.0.0.1:6380`

### 3. Install dependencies

```bash
pnpm install
```

### 4. Initialize and seed PostgreSQL

```bash
pnpm db:generate
pnpm db:push
pnpm db:seed
```

Seeded test accounts:

- **Owner**: `demo@brightdental.com` / `password123`
- **Staff**: `sarah@brightdental.com` / `password123`
- **Workspace**: Bright Dental (`slug: bright-dental`)

These credentials are for local development only. Change them before any
shared or public deployment.

### 5. Start development servers

```bash
pnpm dev
```

Or run them separately:

```bash
pnpm dev:api   # Fastify on http://localhost:4000
pnpm dev:web   # Next.js on http://localhost:3000
```

- Dashboard: http://localhost:3000
- API health: http://localhost:4000/api/v1/health

### 6. Quality checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

See the root [README](../../README.md) and [CONTRIBUTING.md](../../CONTRIBUTING.md)
for the project map and pull-request expectations.
