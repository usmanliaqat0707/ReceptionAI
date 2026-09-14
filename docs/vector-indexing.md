# ReceptionAI — Vector Indexing & Hybrid Search Architecture

## 1. Database Extensions & Prerequisites
ReceptionAI utilizes **PostgreSQL 16** with the **`pgvector`** extension (`vector >= 0.8.0`).

Extension initialization:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

---

## 2. Table Schema & Column Specifications
Vector embeddings are stored on the `knowledge_chunks` table:

```sql
CREATE TABLE "knowledge_chunks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "generationId" TEXT,
    "chunkIndex" INTEGER NOT NULL DEFAULT 0,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "headingPath" TEXT,
    "metadata" JSONB,
    "embedding" vector(1536),
    "embeddingModel" TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fk_knowledge_chunks_workspace" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE,
    CONSTRAINT "fk_knowledge_chunks_source" FOREIGN KEY ("sourceId") REFERENCES "knowledge_sources"("id") ON DELETE CASCADE,
    CONSTRAINT "fk_knowledge_chunks_document" FOREIGN KEY ("documentId") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE
);
```

---

## 3. High-Performance Indexing Strategy

### 3.1 pgvector HNSW Vector Index
Cosine distance indexing is applied using Hierarchical Navigable Small World (HNSW) graphs:
```sql
CREATE INDEX IF NOT EXISTS "idx_knowledge_chunks_embedding_hnsw" 
ON "knowledge_chunks" 
USING hnsw ("embedding" vector_cosine_ops);
```
- **Distance Operator**: `<=>` (cosine distance).
- **Metric**: Cosine similarity $= 1 - (\text{embedding} \Leftrightarrow \text{query\_vector})$.
- **Benefits**: Near-constant query latency ($O(\log N)$) even as knowledge chunks scale to hundreds of thousands of records.

### 3.2 Full-Text Search (GIN) Lexical Index
Generalized Inverted Index (GIN) on english language lexemes:
```sql
CREATE INDEX IF NOT EXISTS "idx_knowledge_chunks_content_fts" 
ON "knowledge_chunks" 
USING gin (to_tsvector('english', "content"));
```

---

## 4. Multi-Tenant Scoped Retrieval Query
Retrieval executes as a single parameterized query combining vector distance and full-text ranking:

```sql
WITH candidate_chunks AS (
  SELECT 
    c."id" AS "chunkId",
    c."workspaceId",
    c."content",
    c."headingPath",
    c."documentId",
    d."title" AS "documentTitle",
    d."externalUrl" AS "documentUrl",
    s."name" AS "sourceName",
    s."id" AS "sourceId",
    GREATEST(0.0, 1.0 - (c."embedding" <=> $1::vector)) AS "vectorScore",
    COALESCE(
      ts_rank_cd(to_tsvector('english', c."content"), plainto_tsquery('english', $2)),
      0.0
    ) AS "textScore"
  FROM "knowledge_chunks" c
  JOIN "knowledge_documents" d ON d."id" = c."documentId"
  JOIN "knowledge_sources" s ON s."id" = c."sourceId"
  JOIN "receptionist_knowledge_sources" rks 
    ON rks."knowledgeSourceId" = s."id" AND rks."receptionistId" = $3
  WHERE 
    c."workspaceId" = $4
    AND d."workspaceId" = $4
    AND s."workspaceId" = $4
    AND s."status" = 'READY'
    AND s."archivedAt" IS NULL
    AND d."status" = 'ACTIVE'
    AND c."embedding" IS NOT NULL
)
SELECT 
  "chunkId",
  "workspaceId",
  "content",
  "headingPath",
  "documentId",
  "documentTitle",
  "documentUrl",
  "sourceName",
  "vectorScore",
  "textScore",
  ($5 * "vectorScore" + $6 * LEAST(1.0, "textScore" * 2.0)) AS "hybridScore"
FROM candidate_chunks
ORDER BY "hybridScore" DESC
LIMIT 20;
```
