# Contributing to ReceptionAI

Thank you for helping maintain a multi-tenant AI receptionist platform.
This repository is security-sensitive. Small, reviewable changes are easier
to land than large mixed refactors.

## Before you start

1. Read the [Code of Conduct](CODE_OF_CONDUCT.md).
2. Search existing issues and pull requests.
3. For security findings, follow [SECURITY.md](SECURITY.md) instead of opening
   a public issue.
4. For design-heavy work (new providers, schema changes, tool mutations),
   open an issue first so maintainers can confirm the approach.

## Development setup

Follow [docs/development/local-setup.md](docs/development/local-setup.md).

```bash
cp .env.example .env
pnpm db:up
pnpm install
pnpm db:push
pnpm db:seed
pnpm dev
```

Prerequisites: Node.js 20+, pnpm 11.25.0, Docker.

## Project map

| Path | Responsibility |
| ---- | -------------- |
| `apps/web` | Next.js 14 dashboard |
| `apps/api` | Fastify API, tools, RAG, scheduling, communications |
| `apps/realtime-gateway` | Voice streaming stub |
| `apps/worker` | Background job stub |
| `packages/db` | Prisma schema, client, seed |
| `packages/config` | Env validation and RBAC matrix |
| `packages/security` | Token hashing, passwords, permission checks |
| `packages/validation` | Shared Zod schemas |
| `packages/observability` | Structured logging with redaction |

## How to make a change

1. Create a branch from `master`: `git checkout -b fix/short-description`.
2. Keep the change scoped to one concern.
3. Match existing TypeScript, Prettier, and naming conventions.
4. Add or update tests in `apps/api/test` when you change auth, tenancy,
   tools, knowledge, appointments, or communications.
5. Update the relevant file under `docs/` when behavior or threat models
   change.
6. Run the local quality gate before you open a pull request.

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Pull request checklist

- [ ] Title describes the user-visible or maintainer-visible outcome
- [ ] Description explains why the change is needed
- [ ] Tests cover the new path or the bug
- [ ] Docs are updated when contracts or threat models change
- [ ] No secrets, live credentials, or production dumps are included
- [ ] Tenant queries still go through `requireWorkspaceAccess`
- [ ] AI tools still go through the tool gateway and confirmation rules

Pull requests are reviewed by maintainers. Codex may leave a first-pass
review when `OPENAI_API_KEY` is configured for GitHub Actions, or when a
maintainer comments `@codex review`. Maintainers still make the merge
decision.

## Reporting bugs and proposing features

Use the GitHub issue templates:

- **Bug report** for incorrect or unsafe behavior
- **Feature request** for product or maintainer-workflow ideas

Include reproduction steps, expected behavior, and the workspace role you
used. Do not attach real customer phone numbers, emails, or calendar tokens.

## Commit style

Prefer conventional commits so release notes stay readable:

- `feat:` user-visible capability
- `fix:` defect
- `security:` vulnerability or hardening
- `docs:` documentation only
- `test:` tests only
- `chore:` tooling, CI, dependencies

## What we will not merge

- Changes that trust a client-supplied `workspaceId` for authorization
- Direct provider calls that bypass the tool gateway or communication policy
- Knowledge crawls that skip SSRF validation
- Secrets in source, fixtures, or logs
- Drive-by refactors mixed with a functional change
