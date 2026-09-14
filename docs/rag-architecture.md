# ReceptionAI — RAG Architecture

## 1. End-to-End Flow
ReceptionAI implements a trusted, tenant-isolated Retrieval-Augmented Generation (RAG) architecture:

```
[Ingestion Pipeline]
Documents/Websites/FAQs 
   -> SSRF Validator 
   -> Type Extractors (PDF, DOCX, TXT, MD, Cheerio HTML, FAQ) 
   -> Heading-Aware Chunker (400 tokens / 50 overlap, SHA-256) 
   -> EmbeddingProvider (OpenAI text-embedding-3-small, 1536 dim) 
   -> KnowledgeIndexGeneration (atomic versioning)
   -> PostgreSQL (pgvector HNSW + FTS GIN)

[Retrieval Pipeline]
AI Voice Playground / Live Agent 
   -> search_knowledge_base tool call 
   -> Trusted Server-Side Tool Gateway 
   -> KnowledgeRetrievalService 
   -> Multi-tenant Scoping ($workspaceId + $receptionistId + READY + ACTIVE) 
   -> Hybrid Search (0.7 * Vector Cosine + 0.3 * Text FTS Rank) 
   -> Threshold Filter (>= 0.35) + Diversity Cap (max 2 chunks/doc) 
   -> Untrusted Content Delimiters 
   -> AI Voice Runtime
```

---

## 2. Hybrid Search Scoring Formula
Retrieval combines dense semantic similarity (vector distance) and sparse lexical matching (PostgreSQL `ts_rank_cd`):

$$\text{HybridScore} = (w_v \cdot \text{VectorScore}) + (w_l \cdot \min(1.0, 2.0 \cdot \text{TextScore}))$$

Where default weights are configured in `@receptionai/config`:
- $w_v = 0.7$ (`DEFAULT_HYBRID_VECTOR_WEIGHT`)
- $w_l = 0.3$ (`DEFAULT_HYBRID_LEXICAL_WEIGHT`)
- $\text{VectorScore} = \max(0.0, 1.0 - (\text{chunk.embedding} \Leftrightarrow \text{query.vector}))$
- $\text{TextScore} = \text{ts\_rank\_cd}(\text{to\_tsvector}('english', \text{content}), \text{plainto\_tsquery}('english', \text{query}))$

---

## 3. Atomic Index Generations
Reindexing a knowledge source never breaks live calls or causes partial query responses:
1. When reindexing begins, a new `KnowledgeIndexGeneration` record is created in `PENDING` state.
2. Documents and chunks are extracted and embedded under this new generation ID.
3. The previous generation continues serving incoming calls without interruption.
4. Once all chunks are embedded and indexed, `KnowledgeSource.activeGenerationId` is updated atomically, and the new generation is marked `COMPLETED`.
5. Older generations are archived asynchronously.

---

## 4. Multi-Tenant Scoping & Zero-Leakage Guarantees
Every SQL retrieval query enforces:
```sql
WHERE c."workspaceId" = $workspaceId
  AND s."workspaceId" = $workspaceId
  AND s."status" = 'READY'
  AND s."archivedAt" IS NULL
  AND d."status" = 'ACTIVE'
  AND s."id" IN (
    SELECT "knowledgeSourceId" FROM "receptionist_knowledge_sources" 
    WHERE "receptionistId" = $receptionistId
  )
```
In addition, the application layer performs defense-in-depth verification that `chunk.workspaceId === workspaceId` for every returned item before formatting the tool response.
