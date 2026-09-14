# ReceptionAI — Knowledge Ingestion Pipeline

## 1. Pipeline Overview
The `KnowledgeIngestionService` converts raw multi-format business content into structured, tenant-isolated vector embeddings and full-text indexes.

```
[Raw Content]
  -> [Extractor Layer] (Text, Markdown, PDF, DOCX, HTML, FAQ)
  -> [Chunker Layer] (Token budget, Heading preservation, Overlap)
  -> [Embedding Layer] (OpenAI text-embedding-3-small, 1536 dim)
  -> [Storage Layer] (pgvector HNSW + FTS tsvector)
  -> [Atomic Cutover] (Update activeGenerationId on source)
```

---

## 2. Extractors

### 2.1 PDF Extractor (`PdfExtractor`)
- Leverages `pdf-parse` to extract page text and metadata.
- Detects image-only/scanned PDFs with insufficient text content and raises informative errors.

### 2.2 DOCX Extractor (`DocxExtractor`)
- Uses `mammoth` to extract clean raw text while stripping styling artifacts.

### 2.3 Web Crawler (`WebsiteCrawlerService` + `HtmlExtractor`)
- Crawls up to 30 pages within the same host origin up to depth 3.
- Enforces strict SSRF validation on initial URL and on every HTTP redirect target.
- Strips script, style, nav, footer, SVG, and cookie banner tags via `cheerio`.
- Honors 5MB max payload limits.

### 2.4 FAQ Extractor (`FaqExtractor`)
- Ingests structured arrays of Q&A objects `{ question: string, answer: string }`.
- Preserves explicit question context in `headingPath`.

---

## 3. Chunking & Budgeting (`ChunkerService`)
- Default chunk size: **400 tokens** (~1600 characters).
- Default overlap: **50 tokens** (~200 characters).
- Heading hierarchy awareness: Tracks `# H1`, `## H2`, `### H3` to attach breadcrumbs (e.g. `Bright Dental > Clinical Policies > Cancellations`) to every chunk.
- Deterministic SHA-256 content hashing prevents duplicate chunk insertion and supports delta indexing.

---

## 4. Atomic Index Generations
1. Every ingestion run operates on a unique `KnowledgeIndexGeneration` (sequential generation integer).
2. Existing active generations continue serving live voice sessions without disruption.
3. Once all chunks are written to `knowledge_chunks`, the source's `activeGenerationId` is updated in a transaction.
4. Old generations are archived asynchronously.
