# API service review rules

These rules apply to `apps/api`. Root `AGENTS.md` still applies.

## Code Review Rules

### Route authentication

Search for new `app.get` / `app.post` / `app.patch` / `app.delete`
registrations under `src/modules` that read or write tenant data without
`authenticateSession` and `requireWorkspaceAccess`.

Health checks, auth bootstrap, and documented public provider webhooks are
the only exceptions. Webhooks still need signature verification.

### Error sanitization

Search for 500 handlers or `reply.send` calls that forward raw driver
errors, stack traces, or Zod issue objects with internal paths to clients
in production. Keep the existing `{ error: { code, message, requestId } }`
envelope.

### Test coverage for security paths

If a PR changes tenancy, SSRF, tools, webhooks, or communications policy,
it should add or update a test in `apps/api/test`. A docs-only explanation
is not a substitute for a failing-then-passing security test.
