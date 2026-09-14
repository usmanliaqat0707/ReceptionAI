## Summary

<!-- Why this change exists. Link the issue if there is one. -->

## Change type

- [ ] Bug fix
- [ ] Feature
- [ ] Security hardening
- [ ] Documentation
- [ ] Tests / CI
- [ ] Refactor (no behavior change)

## How I verified it

<!-- Commands you ran, or the UI path you exercised. -->

- [ ] `pnpm format:check`
- [ ] `pnpm lint`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build`

## Security checklist

- [ ] Tenant queries are scoped by `workspaceId` after `requireWorkspaceAccess`
- [ ] No secrets, raw tokens, or live customer PII are included
- [ ] AI tools, crawls, webhooks, or outbound messages still pass policy checks
- [ ] Docs or tests updated when a threat model or public contract changed

## Review notes

<!-- Anything a maintainer or Codex should look at first. -->
