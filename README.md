# ReceptionAI — Multi-Tenant AI Voice Receptionist SaaS Platform

> **Current Status**: **Phase 0 (Engineering Foundation)** and **Phase 1 (SaaS Core)** are complete.  
> ⚠️ **Notice**: Realtime voice, telephony, WebRTC, OpenAI Realtime, and telephony carrier integrations are **NOT** implemented yet and will be delivered in future phases.

---

## 1. Product Overview

ReceptionAI is an enterprise-grade multi-tenant SaaS platform built to empower businesses to deploy virtual AI voice receptionists that handle phone inquiries, triage emergencies, book appointments, and capture qualified leads.

Phase 0 & Phase 1 establish the engineering foundation, cryptographic security, multi-tenant workspace isolation, centralized RBAC, session management, and immutable audit logs.

---

## 2. Tenancy Hierarchy

```text
User
 └── Workspace Membership
      └── Workspace
           ├── Receptionists (Phase 2)
           ├── Knowledge Base (Phase 2)
           ├── Calls (Phase 3)
           ├── Contacts (Phase 3)
           ├── Leads (Phase 3)
           ├── Appointments (Phase 3)
           ├── Integrations (Phase 3)
           └── Audit Logs (Phase 1)
```

---

## 3. Monorepo Structure

```text
reception-ai/
│
├── apps/
│   ├── web/                # Next.js 14 App Router frontend (Tailwind CSS, shadcn/ui style)
│   ├── api/                # Fastify backend API with modular routes & plugins
│   ├── realtime-gateway/   # Minimal bootstrap stub (ready for Phase 3 voice streaming)
│   └── worker/             # Minimal bootstrap stub (ready for Phase 3 background tasks)
│
├── packages/
│   ├── db/                 # Prisma PostgreSQL schema, client, migrations, & seeds
│   ├── config/             # Zod environment validation & role permissions matrix
│   ├── validation/         # Shared request and domain validation schemas
│   ├── security/           # Opaque token hashing, bcrypt password security, & RBAC
│   ├── observability/      # Structured Pino logging with automatic secret redaction
│   └── ui/                 # Reusable UI component library primitives
│
├── infrastructure/
│   └── docker/             # Docker Compose for PostgreSQL 16 & Redis 7
│
├── docs/
│   ├── architecture/       # System architecture and request flow diagrams
│   ├── security/           # Authentication, session hashing, & tenancy isolation
│   └── development/        # Local development setup and instructions
│
├── .github/
│   └── workflows/ci.yml    # GitHub Actions workflow (format, lint, typecheck, test, build)
│
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── tsconfig.base.json
```

---

## 4. Getting Started

### Prerequisites

- Node.js `>= 20.0.0`
- `pnpm` (`npm install -g pnpm`)
- Docker & Docker Compose

### Step 1: Start PostgreSQL & Redis

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d
```

### Step 2: Install Dependencies

```bash
pnpm install
```

### Step 3: Run Database Migrations & Seed Data

```bash
pnpm db:push
pnpm db:seed
```

Default local development credentials:

- **Email**: `demo@brightdental.com`
- **Password**: `password123`
- **Workspace**: Bright Dental (`slug: bright-dental`)

### Step 4: Run Development Servers

```bash
pnpm dev
```

- **Frontend Application**: [http://localhost:3000](http://localhost:3000)
- **Fastify API Backend**: [http://localhost:4000/api/v1/health](http://localhost:4000/api/v1/health)

---

## 5. Verification & Testing

Execute the complete quality validation pipeline:

```bash
pnpm format:check   # Verifies code formatting with Prettier
pnpm lint           # Runs ESLint across all apps and packages
pnpm typecheck      # Runs strict TypeScript checks across monorepo
pnpm test           # Executes Vitest integration tests (auth, tenancy, RBAC)
pnpm build          # Generates production builds via Turborepo
```

---

## 6. Security Controls

- **Opaque Session Tokens**: Cryptographically random 64-character tokens stored exclusively as SHA-256 hashes in PostgreSQL; cookies transmitted with `httpOnly`, `sameSite: lax`, and `secure`.
- **Tenant Isolation**: Every tenant query requires explicit workspace membership verification; client-supplied workspace identifiers are never trusted for authorization.
- **Last-Owner Safeguards**: A workspace's only active owner cannot be removed or demoted.
- **Audit Trails**: Administrative operations (workspace updates, member invites, role changes, session revocations) are recorded as immutable audit log entries.
