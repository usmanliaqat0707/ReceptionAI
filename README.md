# ReceptionAI

[![CI](https://img.shields.io/badge/CI-GitHub%20Actions-2088FF?logo=githubactions&logoColor=white)](.github/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](package.json)
[![pnpm](https://img.shields.io/badge/pnpm-11.25-F69220?logo=pnpm&logoColor=white)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](tsconfig.base.json)

Open-source, multi-tenant platform for building AI voice receptionists that answer business questions, capture leads, book appointments, and send follow-up messages — with tenant isolation and tool safety treated as product features.

ReceptionAI is a reference implementation for teams who need production-shaped AI agents: hashed sessions, workspace RBAC, a confirmation-gated tool gateway, hybrid RAG with SSRF controls, and calendar-aware scheduling. It is not a thin demo wrapper around a single model call.

## Why this project exists

Most voice-agent samples skip the hard parts: who is allowed to see which workspace, what the model is allowed to mutate, how retrieved documents are prevented from becoming instructions, and how SMS or email stays off an open relay.

ReceptionAI keeps those controls in the open so maintainers, researchers, and operators can review and reuse them. The intended users are:

- Developers building AI reception, scheduling, or inbound-triage products
- Security reviewers studying multi-tenant agent architectures
- Contributors who want a real monorepo to practice maintainer workflows

## Current capabilities

| Area | What ships today |
| ---- | ---------------- |
| SaaS core | Workspaces, invitations, five-role RBAC, opaque session tokens, audit log |
| Receptionists | Persona builder, objectives, transfer destinations, policy runtime |
| Voice playground | OpenAI Realtime test sessions with a browser client and tool calls |
| Knowledge | File, FAQ, HTML, and crawl ingestion; chunking; hybrid retrieval |
| Scheduling | Services, availability engine, signed slot tokens, appointment sagas |
| Calendar | Internal demo calendar plus Google Calendar OAuth |
| Communications | Template engine, SMS/email outbox, Twilio and Resend providers, webhooks |
| CRM-lite | Contacts, leads, and internal messages |

**Not in this tree yet:** production telephony or carrier SIP trunks. `apps/realtime-gateway` and `apps/worker` are bootstraps for that work. The dashboard Calls page is a placeholder until inbound PSTN lands.

## Architecture

```text
 Browser (Next.js 14)                 Fastify API
┌─────────────────────┐              ┌──────────────────────────┐
│ Dashboard           │  HTTP +      │ Auth, RBAC, audit        │
│ Receptionist test   │  cookies ──► │ Tool gateway             │
│ Knowledge / books   │              │ RAG, scheduling, comms   │
└─────────────────────┘              └────────────┬─────────────┘
                                                  │
                         PostgreSQL 16 + pgvector │  Redis 7
                         (tenant data, embeddings)│  (rate limits)
```

Monorepo layout:

```text
apps/web                 Next.js dashboard
apps/api                 Fastify API and domain services
apps/realtime-gateway    Voice streaming stub
apps/worker              Background job stub
packages/db              Prisma schema, client, seed
packages/config          Env validation and permission matrix
packages/security        Token / password hashing and RBAC helpers
packages/validation      Shared Zod schemas
packages/observability   Pino logging with secret redaction
docs/                    Architecture and threat models
```

## Security posture

These are enforced in code, not only described in docs:

- Session tokens are random and stored as SHA-256 hashes; cookies are `httpOnly`
- Workspace membership is checked on every tenant route; ids are not credentials
- The last remaining owner cannot be removed or demoted
- Knowledge crawls validate DNS and block metadata, loopback, and RFC1918 targets
- Retrieved knowledge is treated as untrusted reference data
- SMS and email go through an anti-open-relay policy
- Tool mutations use confirmation windows and signed slot tokens

Read [SECURITY.md](SECURITY.md) to report a vulnerability. Reviewers should start with [AGENTS.md](AGENTS.md).

## Quick start

**Prerequisites:** Node.js 20+, [pnpm](https://pnpm.io) 11.25, Docker.

```bash
git clone https://github.com/usmanliaqat0707/ReceptionAI.git
cd ReceptionAI
cp .env.example .env

pnpm db:up
pnpm install
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm dev
```

- Dashboard: [http://localhost:3000](http://localhost:3000)
- API health: [http://localhost:4000/api/v1/health](http://localhost:4000/api/v1/health)

Demo workspace (local only):

| Field | Value |
| ----- | ----- |
| Email | `demo@brightdental.com` |
| Password | `password123` |
| Workspace | Bright Dental (`bright-dental`) |

OpenAI, Google Calendar, Twilio, and Resend keys are optional. Without them the API uses mock embeddings, the internal demo calendar, and mock SMS/email.

Full walkthrough: [docs/development/local-setup.md](docs/development/local-setup.md).

## Quality gate

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

CI runs the same commands against PostgreSQL and Redis. See [.github/workflows/ci.yml](.github/workflows/ci.yml).

## Documentation

| Topic | Document |
| ----- | -------- |
| Architecture | [docs/architecture/overview.md](docs/architecture/overview.md) |
| Auth | [docs/security/authentication.md](docs/security/authentication.md) |
| Tenancy | [docs/security/multi-tenancy.md](docs/security/multi-tenancy.md) |
| RAG | [docs/rag-architecture.md](docs/rag-architecture.md) |
| Scheduling | [docs/availability-engine.md](docs/availability-engine.md) |
| Communications | [docs/messaging-architecture.md](docs/messaging-architecture.md) |
| All docs | [docs/README.md](docs/README.md) |

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md) before opening a pull request.

Maintainers use Codex for first-pass review. After `OPENAI_API_KEY` is configured on the repository, pull requests can receive an automated review from [`.github/workflows/codex-review.yml`](.github/workflows/codex-review.yml). You can also comment `@codex review` once Codex is connected to the repo. Humans still approve merges.

## License

Licensed under the [Apache License 2.0](LICENSE).
