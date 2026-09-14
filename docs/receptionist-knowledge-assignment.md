# ReceptionAI — Receptionist Knowledge Assignment & Multi-Tenant Isolation

## 1. Tenancy Model
Knowledge sources belong strictly to a single `Workspace`. A receptionist belongs strictly to a single `Workspace`.

The junction table `receptionist_knowledge_sources` maps which knowledge sources an AI receptionist is permitted to query during voice calls:

```
[ Workspace A ]                                [ Workspace B ]
  |-- Receptionist Ava                           |-- Receptionist Bob
  |-- Source 1 (Clinical Policies) [ASSIGNED]    |-- Source 3 (Catalog) [ASSIGNED]
  |-- Source 2 (Internal Memo)     [UNASSIGNED]
```

---

## 2. Hard Security Boundaries

### 2.1 Workspace Isolation
A receptionist in Workspace A can NEVER query, access, or retrieve knowledge chunks from Workspace B.
Even if a caller supplies query terms matching Workspace B documents, PostgreSQL queries enforce `workspaceId = $1`.

### 2.2 Unassigned Source Isolation
Even within the SAME workspace, a receptionist can ONLY query knowledge sources explicitly assigned to it in `receptionist_knowledge_sources`.
Internal executive memos, employee HR guidelines, or unassigned knowledge sources in Workspace A are completely inaccessible to Receptionist Ava.

### 2.3 Ready & Active Status Checks
Only sources with `status = 'READY'` and `archivedAt IS NULL` and documents with `status = 'ACTIVE'` can produce chunks in search results.
Archiving a knowledge source immediately excludes all of its chunks from voice retrieval in real time.

### 2.4 Cross-Tenant Assignment Prevention
Attempting to assign a knowledge source from Workspace B to a receptionist in Workspace A is rejected by the REST API with:
`400 KNOWLEDGE_ASSIGNMENT_CROSS_TENANT_REJECTED`.

---

## 3. Automated Isolation Verification
Our test suite (`test/knowledge-retrieval.test.ts`) verifies these boundaries continuously:
- **Sentinel Test**: Workspace A possesses chunk `BRIGHT_DENTAL_SENTINEL_X992_CLINICAL_SECRET`. Workspace B possesses chunk `SHOPFLOW_PRIVATE_SENTINEL_9824X_ECOMMERCE_SECRET`. Queries executed from Workspace B return 0 results containing Sentinel A. Zero cross-tenant leakage is tolerated.
- **Unassigned Test**: Workspace A creates `UNASSIGNED_SOURCE_INTERNAL_ONLY_DATA`. Receptionist Ava queries for this content and receives 0 results.
