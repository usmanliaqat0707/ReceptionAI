# ReceptionAI agent and reviewer guide

This repository is a multi-tenant AI receptionist platform. Coding agents
and human reviewers should optimize for tenant isolation, tool safety, and
reviewable diffs — not for raw feature volume.

## Repository layout

- `apps/web` — Next.js 14 App Router dashboard. Keep `'use client'` only
  where browser APIs or local UI state are required.
- `apps/api` — Fastify API. Domain logic lives in `src/modules/*/services`.
  HTTP handlers stay thin and call `requireWorkspaceAccess`.
- `packages/db` — Prisma schema is the source of truth for tenancy keys.
- `packages/config` — Environment validation and the RBAC permission matrix.
- `packages/security` — Token hashing, password hashing, permission checks.
- `packages/validation` — Shared Zod request schemas.
- `docs/` — Threat models and architecture. Update these when behavior
  changes.

## Non-negotiable invariants

1. **Never trust client-supplied workspace identifiers for authorization.**
   Every tenant query must prove an authenticated session and an active
   membership through `requireWorkspaceAccess` in
   `apps/api/src/middleware/auth.ts`.
2. **Scope every Prisma query with `workspaceId`.** Do not look up contacts,
   leads, appointments, knowledge sources, or communications by id alone.
3. **AI tools mutate state only through the tool gateway** in
   `apps/api/src/modules/tools`. Do not give the model raw database access
   or provider credentials.
4. **Knowledge content is untrusted reference data.** Retrieved chunks must
   never override system, tool, or receptionist instructions. See
   `docs/prompt-injection-defenses.md`.
5. **Outbound crawl and fetch paths must use `SSRFValidatorService`.**
   Block localhost, link-local, metadata, and RFC1918 targets. See
   `docs/ssrf-security.md`.
6. **Communications are not an open relay.** Recipients and templates must
   pass `communication-policy.service` before send. See
   `docs/anti-open-relay-policy.md`.
7. **Do not log secrets.** Session tokens, password hashes, OAuth tokens,
   API keys, webhook secrets, and raw slot tokens stay out of logs, audit
   metadata, and API error payloads.
8. **Keep mechanical style in CI.** Do not spend review comments on
   formatting that Prettier or TypeScript already enforces.

## How to work in this repo

- Prefer the smallest change that preserves existing names and contracts.
- Add or update tests in `apps/api/test` for auth, tenancy, tools,
  knowledge, appointments, communications, and SSRF.
- After schema edits, run `pnpm db:generate` and update seed data only when
  the demo workspace still needs it.
- Copy `.env.example` instead of inventing environment variables.
- Use mock SMS/email providers and the internal demo calendar unless a
  change specifically targets a live provider.

## Verification

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Code Review Rules

### Tenant isolation

Search for authorization bypasses and cross-tenant reads:

- New or changed API routes that accept `workspaceId`, slugs, or record ids
  must call `requireWorkspaceAccess` before any tenant query.
- Prisma `findUnique` / `findFirst` / `update` / `delete` on tenant records
  must include `workspaceId` in the `where` clause.
- Client-supplied workspace ids are unverified input, not proof of access.

Safe path: reuse `authenticateSession` plus `requireWorkspaceAccess`, then
query with both the record id and `workspaceId`.

### Secret and PII handling

Search for leakage of credentials and caller data:

- Do not persist raw session tokens, password-reset tokens, or slot tokens.
  Store SHA-256 hashes only.
- Do not log `Authorization` headers, cookies, OAuth refresh tokens,
  webhook signatures, or provider API keys.
- API responses and audit `metadata` must not include password hashes,
  raw tokens, or full recipient secrets unless a documented
  `communications.view_recipient` path already exists.

Safe path: hash tokens with `packages/security`, redact with the
observability logger, and keep secrets in environment variables.

### Tool and confirmation safety

Search for AI-driven mutations that skip policy:

- New tool handlers must register in the tool registry and execute through
  the tool gateway.
- Booking, cancel, reschedule, and outbound-message tools must keep the
  existing confirmation / slot-token expiry rules.
- Do not add a tool that sends SMS or email to an arbitrary caller-supplied
  address without the communication policy checks.

Safe path: add the handler under `apps/api/src/modules/tools/handlers`,
enforce confirmation in the domain service, and cover it with a test.

### Knowledge fetch and prompt trust

Search for SSRF and instruction override:

- URL crawl, file fetch, and redirect follow must call
  `SSRFValidatorService` on every target, including redirects.
- `search_knowledge` results are reference data. Do not concatenate retrieved
  text into system instructions or tool allow-lists.

Safe path: keep retrieval inside `search-knowledge.handler.ts` and preserve
the untrusted-content delimiters described in
`docs/prompt-injection-defenses.md`.

### Provider webhooks and OAuth

Search for unauthenticated inbound provider callbacks:

- Twilio and Resend webhook routes must verify signatures except in explicit
  test doubles.
- Google Calendar OAuth callbacks must validate state and never echo client
  secrets.

Safe path: follow `docs/provider-webhooks.md` and
`docs/calendar-integrations.md`.
