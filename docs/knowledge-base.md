# ReceptionAI — Knowledge Base & RAG Domain

## 1. Overview
The **Knowledge Base** module allows multi-tenant workspaces to provide business-specific factual context to their AI Receptionists. By grounding voice agent answers in verified documentation, receptionists can answer complex business inquiries about services, clinical policies, pricing, and operating rules without hallucinating.

---

## 2. Knowledge Source Types
ReceptionAI supports 8 source types:

| Type | Description | Ingestion Method |
| :--- | :--- | :--- |
| `MANUAL` | Freeform text or markdown entered directly in the dashboard | `TextExtractor` |
| `FAQ` | Structured Question & Answer pairs | `FaqExtractor` |
| `WEBSITE` | Public company website root URL | `WebsiteCrawlerService` (SSRF protected, max 30 pages) |
| `SITEMAP` | XML sitemap containing approved URLs | XML parser + Crawler |
| `PDF` | Uploaded PDF manuals, pamphlets, or policies | `PdfExtractor` (`pdf-parse`) |
| `DOCX` | Uploaded Microsoft Word documents | `DocxExtractor` (`mammoth`) |
| `TXT` | Plain text files | `TextExtractor` |
| `MARKDOWN` | Markdown documentation | `TextExtractor` |

---

## 3. Ingestion Lifecycle
A knowledge source transitions through the following lifecycle states:

```
[ PENDING ] -> [ PROCESSING ] -> [ READY ]
                       |
                       v
                   [ FAILED ]
```

- **`PENDING`**: Source created or updated; queued for background extraction and indexing.
- **`PROCESSING`**: Extractor runs, heading-aware chunker produces bounded segments, embeddings are generated, and pgvector chunks are indexed in a new atomic generation.
- **`READY`**: Generation completed successfully and marked active. Instantly retrievable by assigned receptionists.
- **`FAILED`**: Extraction or embedding encountered an error. A sanitized error message (`errorMessageSafe`) is stored.
- **`ARCHIVED`**: Soft-deleted source. Immediately excluded from all retrieval queries.

---

## 4. RBAC & Permissions
Knowledge base actions are governed by workspace RBAC:

- `knowledge.read`: View knowledge sources, documents, and chunk counts (`OWNER`, `ADMIN`, `AGENT_MANAGER`, `RECEPTION_STAFF`, `VIEWER`).
- `knowledge.create`: Create sources or upload files (`OWNER`, `ADMIN`, `AGENT_MANAGER`).
- `knowledge.update`: Edit source metadata or text (`OWNER`, `ADMIN`, `AGENT_MANAGER`).
- `knowledge.archive`: Soft-delete sources (`OWNER`, `ADMIN`).
- `knowledge.reindex`: Trigger reindexing (`OWNER`, `ADMIN`, `AGENT_MANAGER`).
- `knowledge.assign`: Assign sources to AI receptionists (`OWNER`, `ADMIN`, `AGENT_MANAGER`).
