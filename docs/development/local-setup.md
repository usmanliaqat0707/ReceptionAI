# Local Development Guide

## Prerequisites

- Node.js 20.x LTS
- `pnpm` (`npm install -g pnpm`)
- Docker & Docker Compose

## Quick Start Workflow

### 1. Start Database & Redis Infrastructure

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d
```

Service mapping:

- PostgreSQL 16: `127.0.0.1:5433`
- Redis 7: `127.0.0.1:6380`

### 2. Install Monorepo Dependencies

```bash
pnpm install
```

### 3. Initialize & Seed PostgreSQL

```bash
pnpm db:push
pnpm db:seed
```

Seeded test accounts:

- **Owner**: `demo@brightdental.com` / `password123`
- **Staff**: `sarah@brightdental.com` / `password123`
- **Workspace**: Bright Dental (`slug: bright-dental`)

### 4. Start Development Servers

To run both API backend (`:4000`) and Next.js frontend (`:3000`) concurrently:

```bash
pnpm dev
```

Or run individually:

```bash
pnpm dev:api   # Runs Fastify backend on http://localhost:4000
pnpm dev:web   # Runs Next.js frontend on http://localhost:3000
```

### 5. Running Quality Checks & Tests

```bash
pnpm format:check   # Prettier validation
pnpm lint           # ESLint across monorepo
pnpm typecheck      # Strict TypeScript check across all packages
pnpm test           # Vitest integration & unit tests
pnpm build          # Turborepo production build
```
