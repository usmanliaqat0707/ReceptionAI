# ReceptionAI Architecture Overview (Phase 0 & Phase 1)

## High-Level System Architecture

```text
                               ┌────────────────────────┐
                               │  Browser / Client SPA  │
                               └───────────┬────────────┘
                                           │
                                           │ HTTP (Cookies / SameSite=Lax)
                                           ▼
                               ┌────────────────────────┐
                               │  apps/web (Next.js 14) │
                               └───────────┬────────────┘
                                           │
                                           │ API Proxy / Rewrites
                                           ▼
                               ┌────────────────────────┐
                               │   apps/api (Fastify)   │
                               └─────┬────────────┬─────┘
                                     │            │
                 Prisma ORM (Pool)   │            │ Redis Client
                                     ▼            ▼
                           ┌─────────────┐    ┌──────────┐
                           │ PostgreSQL  │    │  Redis   │
                           │   Port 5433 │    │ Port 6380│
                           └─────────────┘    └──────────┘

       [Future Phase 3 Components: apps/realtime-gateway & apps/worker]
```

## Monorepo Layout

The repository is configured as a `pnpm workspaces` monorepo orchestrated with `Turborepo`:

- `apps/web`: Next.js 14 App Router application delivering a clean, restrained B2B SaaS interface.
- `apps/api`: Fastify backend handling authentication, workspace tenancy, RBAC enforcement, session management, and immutable audit logs.
- `apps/realtime-gateway`: Clean bootstrap stub ready for Phase 3 WebRTC audio and OpenAI Realtime sessions.
- `apps/worker`: Clean bootstrap stub ready for Phase 3 background job queues and asynchronous task processing.
- `packages/db`: Prisma database client, schema definitions, migrations, and seed scripts.
- `packages/config`: Centralized environment variable validation (Zod) and application constants.
- `packages/validation`: Shared domain and request validation schemas.
- `packages/security`: Cryptographic token generators, password hashing (bcrypt), and authorization logic.
- `packages/observability`: Structured Pino logging with automatic secret redaction and request tracing.
- `packages/ui`: Reusable UI primitives (Buttons, Inputs, Cards, Badges, Tables).

## Current Phase Status

- **Phase 0 (Engineering Foundation)**: Complete
- **Phase 1 (SaaS Core)**: Complete
- **Phase 2 (AI Receptionist Builder & RAG)**: Deferred
- **Phase 3 (Realtime Telephony & Voice Gateway)**: Deferred
