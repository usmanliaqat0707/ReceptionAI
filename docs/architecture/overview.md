# ReceptionAI architecture overview

## High-level system

```text
                               ┌────────────────────────┐
                               │  Browser / dashboard   │
                               └───────────┬────────────┘
                                           │ HTTP cookies (SameSite=Lax)
                                           ▼
                               ┌────────────────────────┐
                               │  apps/web (Next.js 14) │
                               └───────────┬────────────┘
                                           │ API rewrite / same-origin fetch
                                           ▼
                               ┌────────────────────────┐
                               │   apps/api (Fastify)   │
                               └─────┬────────────┬─────┘
                     Prisma + pgvector│            │ Redis
                                     ▼            ▼
                           ┌─────────────┐    ┌──────────┐
                           │ PostgreSQL  │    │  Redis   │
                           │   :5433     │    │  :6380   │
                           └─────────────┘    └──────────┘
```

Optional live providers attach at the API boundary: OpenAI (Realtime and
embeddings), Google Calendar, Twilio SMS, and Resend email. Local development
can run without those keys by using mock embeddings, the internal demo
calendar, and mock communication providers.

`apps/realtime-gateway` and `apps/worker` are reserved for production voice
streaming and background delivery. They are not required for the current
dashboard, playground, RAG, scheduling, or outbox flows.

## Monorepo layout

The repository is a pnpm workspace orchestrated by Turborepo.

| Package | Role |
| ------- | ---- |
| `apps/web` | B2B dashboard and receptionist voice playground |
| `apps/api` | Auth, tenancy, tools, knowledge, appointments, communications |
| `apps/realtime-gateway` | Bootstrap for future WebRTC / telephony streaming |
| `apps/worker` | Bootstrap for future async delivery and crawl workers |
| `packages/db` | Prisma schema, client, seed |
| `packages/config` | Zod env validation, RBAC matrix, domain constants |
| `packages/validation` | Shared request schemas |
| `packages/security` | Token hashing, bcrypt, permission helpers |
| `packages/observability` | Pino logging with secret redaction |
| `packages/ui` | Shared UI primitives |

## Request path for a tenant action

1. The browser sends the `rai_session` cookie to the API.
2. `authenticateSession` hashes the opaque token and loads the user.
3. The route calls `requireWorkspaceAccess(workspaceId, permission)`.
4. Domain services query Prisma with both the record id and `workspaceId`.
5. Mutations that an AI receptionist can trigger also pass through the tool
   gateway, confirmation rules, and (when relevant) communication policy.

Knowledge of a workspace id or slug is never enough to authorize a request.

## Capability status

| Capability | Status |
| ---------- | ------ |
| Engineering foundation (monorepo, CI, env validation) | Implemented |
| SaaS core (auth, workspaces, RBAC, audit) | Implemented |
| Receptionist builder and policy runtime | Implemented |
| OpenAI Realtime playground and tool gateway | Implemented |
| Knowledge ingestion and hybrid RAG | Implemented |
| Appointments, availability, slot tokens | Implemented |
| Google Calendar and internal demo calendar | Implemented |
| SMS / email outbox and provider webhooks | Implemented |
| Production PSTN / carrier telephony | Not implemented |
| Horizontally scaled worker / gateway | Stub only |

## Related documents

- [Local setup](../development/local-setup.md)
- [Authentication](../security/authentication.md)
- [Multi-tenancy](../security/multi-tenancy.md)
- [Documentation index](../README.md)
