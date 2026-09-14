# ReceptionAI documentation

Start with the root [README](../README.md) for product context and local setup.
This index is the map for architecture, security, and domain docs.

## Start here

| Document | Use it when |
| -------- | ----------- |
| [Local setup](development/local-setup.md) | You are running the stack for the first time |
| [Architecture overview](architecture/overview.md) | You need the system map and phase status |
| [Contributing](../CONTRIBUTING.md) | You are opening an issue or pull request |
| [Agent / review rules](../AGENTS.md) | You are reviewing code or using a coding agent |
| [Security policy](../SECURITY.md) | You found a vulnerability |

## Security and tenancy

| Document | Summary |
| -------- | ------- |
| [Authentication](security/authentication.md) | Opaque sessions, password reset, revocation |
| [Multi-tenancy](security/multi-tenancy.md) | Membership checks and RBAC |
| [SSRF defenses](ssrf-security.md) | Crawl and URL fetch restrictions |
| [Prompt-injection defenses](prompt-injection-defenses.md) | Knowledge is untrusted reference data |
| [Anti-open-relay policy](anti-open-relay-policy.md) | Who may receive SMS or email |

## Receptionists and tools

| Document | Summary |
| -------- | ------- |
| [Confirmation protocol](confirmation-protocol.md) | Tool mutations require confirmation |
| [Receptionist knowledge assignment](receptionist-knowledge-assignment.md) | Which sources a receptionist may search |
| [Receptionist scheduling assignment](receptionist-scheduling-assignment.md) | Which services a receptionist may book |

## Knowledge

| Document | Summary |
| -------- | ------- |
| [Knowledge base](knowledge-base.md) | Sources, status, and operator workflows |
| [Ingestion pipeline](ingestion-pipeline.md) | Extract, chunk, embed, index |
| [RAG architecture](rag-architecture.md) | Hybrid retrieval and ranking |
| [Vector indexing](vector-indexing.md) | Embedding models and pgvector |

## Scheduling and calendar

| Document | Summary |
| -------- | ------- |
| [Availability engine](availability-engine.md) | Hours, buffers, and slot search |
| [Slot tokens](slot-tokens.md) | Signed, short-lived booking offers |
| [Scheduling sagas](scheduling-sagas.md) | Book / reschedule / cancel consistency |
| [Calendar integrations](calendar-integrations.md) | Internal demo calendar and Google |
| [Google Calendar setup](google-calendar-setup.md) | OAuth operator guide |

## Communications

| Document | Summary |
| -------- | ------- |
| [Messaging architecture](messaging-architecture.md) | Outbox, providers, and delivery |
| [Communication outbox](communication-outbox.md) | Retry and backoff |
| [Communication templates](communication-templates.md) | Template variables and defaults |
| [Provider webhooks](provider-webhooks.md) | Twilio and Resend signature checks |

## Maintainer notes

| Document | Summary |
| -------- | ------- |
| [Codex for Open Source application](maintainers/codex-for-oss-application.md) | Copy-ready program answers and publish checklist |
