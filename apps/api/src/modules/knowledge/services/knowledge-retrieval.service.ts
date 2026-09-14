import { prisma } from "@receptionai/db";
import {
  DEFAULT_HYBRID_LEXICAL_WEIGHT,
  DEFAULT_HYBRID_VECTOR_WEIGHT,
  DEFAULT_RETRIEVAL_LIMIT,
  DEFAULT_RETRIEVAL_THRESHOLD,
} from "@receptionai/config";
import { EmbeddingProvider } from "../embedding/embedding.interface";
import { OpenAIEmbeddingProvider } from "../embedding/openai-embedding.provider";
import { MockEmbeddingProvider } from "../embedding/mock-embedding.provider";

export interface RetrievalQueryInput {
  workspaceId: string;
  receptionistId: string;
  query: string;
  limit?: number;
}

export interface RetrievalResultItem {
  chunkId: string;
  content: string;
  sourceTitle: string;
  sourceName: string;
  sourceUrl?: string | null;
  headingPath?: string | null;
  score: number;
}

export interface RetrievalResponse {
  results: RetrievalResultItem[];
}

export class KnowledgeRetrievalService {
  private embeddingProvider: EmbeddingProvider;

  constructor(embeddingProvider?: EmbeddingProvider) {
    if (embeddingProvider) {
      this.embeddingProvider = embeddingProvider;
    } else if (process.env.NODE_ENV === "test" || !process.env.OPENAI_API_KEY) {
      this.embeddingProvider = new MockEmbeddingProvider();
    } else {
      this.embeddingProvider = new OpenAIEmbeddingProvider();
    }
  }

  setEmbeddingProvider(provider: EmbeddingProvider) {
    this.embeddingProvider = provider;
  }

  /**
   * Performs tenant-isolated hybrid retrieval (vector similarity + full-text search)
   * scoped strictly to READY knowledge sources assigned to the target receptionist.
   */
  async retrieve(input: RetrievalQueryInput): Promise<RetrievalResponse> {
    const { workspaceId, receptionistId, query } = input;
    const limit = Math.min(input.limit || DEFAULT_RETRIEVAL_LIMIT, 6);

    const cleanQuery = query.trim();
    if (!cleanQuery) {
      return { results: [] };
    }

    // 1. Generate query embedding vector
    const queryVector = await this.embeddingProvider.embedQuery(cleanQuery);
    const vectorString = `[${queryVector.join(",")}]`;

    // 2. Hybrid search query combining pgvector cosine similarity and PostgreSQL FTS
    // Strictly enforces: workspaceId, assigned sources, READY status, not archived, ACTIVE documents
    const rawRows = await prisma.$queryRawUnsafe<any[]>(
      `
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
          -- Vector cosine similarity score (1 - distance)
          GREATEST(0.0, 1.0 - (c."embedding" <=> $1::vector)) AS "vectorScore",
          -- Full-text search rank (normalized between 0 and 1)
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
        -- Combined hybrid score
        ($5 * "vectorScore" + $6 * LEAST(1.0, "textScore" * 2.0)) AS "hybridScore"
      FROM candidate_chunks
      ORDER BY "hybridScore" DESC
      LIMIT 20;
      `,
      vectorString,
      cleanQuery,
      receptionistId,
      workspaceId,
      DEFAULT_HYBRID_VECTOR_WEIGHT,
      DEFAULT_HYBRID_LEXICAL_WEIGHT
    );

    // 3. Defense-in-depth: assert workspaceId match on all returned rows
    for (const row of rawRows) {
      if (row.workspaceId !== workspaceId) {
        throw new Error(
          `CRITICAL_SECURITY_INCIDENT: Cross-tenant leakage detected! Chunk workspace ${row.workspaceId} !== target ${workspaceId}`
        );
      }
    }

    // 4. Filter by threshold & enforce source diversity (max 2 chunks per document)
    const results: RetrievalResultItem[] = [];
    const docCountMap: Record<string, number> = {};

    for (const row of rawRows) {
      const score = Number(row.hybridScore || 0);
      if (score < DEFAULT_RETRIEVAL_THRESHOLD) continue;

      const docId = row.documentId;
      const count = docCountMap[docId] || 0;
      if (count >= 2) continue; // Diversity cap

      docCountMap[docId] = count + 1;

      results.push({
        chunkId: row.chunkId,
        content: row.content,
        sourceTitle: row.documentTitle,
        sourceName: row.sourceName,
        sourceUrl: row.documentUrl || null,
        headingPath: row.headingPath || null,
        score: Number(score.toFixed(4)),
      });

      if (results.length >= limit) break;
    }

    return { results };
  }
}

export const knowledgeRetrieval = new KnowledgeRetrievalService();
