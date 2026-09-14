# Codex for Open Source — application notes

Use this file when you apply at
[https://openai.com/form/codex-for-oss/](https://openai.com/form/codex-for-oss/).
Do not invent usage numbers. The program terms require accurate maintainer
and repository information.

Official pages:

- [Program overview](https://developers.openai.com/community/codex-for-oss)
- [Program terms](https://learn.chatgpt.com/docs/codex-for-oss-terms)

## Publish checklist (do this before you submit)

1. Create a **public** GitHub repository and push `main`.
2. Set your GitHub **profile visibility to public**.
3. Confirm the repository shows `LICENSE`, `README.md`, `SECURITY.md`,
   `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and `AGENTS.md`.
4. Enable [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability).
5. Public repository URL: `https://github.com/usmanliaqat0707/ReceptionAI`
6. After you have API credits, add:
   - Repository secret `OPENAI_API_KEY`
   - Repository Actions variable `CODEX_REVIEW_ENABLED=true`
     so `.github/workflows/codex-review.yml` can run
7. Apply with the ChatGPT account email and a public GitHub username.

## Form: why this repository qualifies

Limit: 500 characters. Counted length: 431.

```text
I am the primary maintainer of ReceptionAI, an open-source multi-tenant AI receptionist platform. I own PR review, issue triage, security (tenant isolation, SSRF, prompt-injection), releases, and docs. The repo is a reference architecture for production AI agents: Fastify + Next.js, RBAC, RAG, calendar scheduling, and OpenAI Realtime with a tool gateway. Codex would reduce review load on security-sensitive AI and calendar code.
```

If you later have public stars, production users, or downstream forks, add
those facts and shorten the architecture sentence so you stay under 500
characters.

## Form: how you will use API credits

Limit: 500 characters. Counted length: 419.

```text
API credits will fund maintainer automation on this authorized repo only: first-pass PR review with openai/codex-action, change summaries, test-gap suggestions, release-note drafts, and issue triage. Maintainers review every AI finding before merge. Credits will not be used for personal experiments or unrelated commercial work. Security-sensitive paths (tenancy, webhooks, RAG, tools) are the priority review targets.
```

## Form: anything else we should know

Limit: 500 characters. Counted length: 354.

```text
The project is security-first (hashed sessions, last-owner safeguards, SSRF validation, anti-open-relay messaging). We want Codex Security on those surfaces. Worker and telephony stubs remain; credits will also help finish release automation and keep docs and tests aligned with a fast-moving AI stack. I will review all Codex output before acting on it.
```

## Maintainer role to select

Choose **primary maintainer** if you own the repository and merge decisions.
Choose **core maintainer** only if you share write access with others and
you regularly review, triage, and release.

## After you are accepted

1. Store `OPENAI_API_KEY` as a GitHub Actions secret.
2. Connect the public repo to Codex Cloud and enable Code Review.
3. Turn on automatic reviews only after one or two `@codex review` trials
   look useful against `AGENTS.md`.
4. Keep humans as the merge gate. Codex is a first-pass reviewer, not a
   substitute for `requireWorkspaceAccess` tests.
