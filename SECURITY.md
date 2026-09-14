# Security Policy

ReceptionAI handles multi-tenant business data, caller records, calendar
credentials, and AI tool actions. Security reports are treated as a
maintainer priority.

## Supported versions

| Version | Supported          |
| ------- | ------------------ |
| `main`  | Yes                |
| Older   | Best-effort only   |

There is no stable numbered release yet. Security fixes land on `main` first.

## How to report a vulnerability

**Do not open a public GitHub issue for security findings.**

Please use one of these private channels:

1. [GitHub private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
   on this repository (preferred).
2. If private reporting is unavailable, email the primary maintainer through
   the address listed on their public GitHub profile and include
   `[ReceptionAI security]` in the subject.

Include:

- A short description of the impact
- Affected paths, endpoints, or components
- Steps to reproduce, a proof of concept, or a failing test
- Whether the issue is already public

You should receive an acknowledgement within **7 days**. We aim to publish a
fix or mitigation, or explain why we are not changing the code, within
**30 days** for confirmed high-impact issues.

## Scope we care about most

Please prioritize reports that affect:

- Cross-tenant data access or workspace ID trust
- Session token storage, cookie flags, or password-reset flows
- SSRF during knowledge crawl or URL fetch
- Prompt injection that causes unauthorized tool mutations
- Open-relay SMS or email sending
- Calendar OAuth token handling
- Unsigned or replayable provider webhooks
- Secret leakage in logs, audit metadata, or API responses

Out of scope unless you can show a realistic exploit path:

- Denial of service from expensive but authenticated RAG or crawl jobs
- Missing rate limits on local development defaults
- Theoretical issues that require a fully compromised workspace owner

## Maintainer security model

The intended invariants are documented in:

- [Authentication](docs/security/authentication.md)
- [Multi-tenancy](docs/security/multi-tenancy.md)
- [SSRF defenses](docs/ssrf-security.md)
- [Prompt-injection defenses](docs/prompt-injection-defenses.md)
- [Anti-open-relay policy](docs/anti-open-relay-policy.md)

Reviewers and coding agents should treat those documents as source-of-truth
for security-sensitive changes. See `AGENTS.md`.

## Safe harbor

We will not pursue legal action against researchers who:

- Act in good faith
- Avoid accessing or retaining other tenants' real data
- Do not degrade production availability
- Give us a reasonable chance to fix the issue before public disclosure
