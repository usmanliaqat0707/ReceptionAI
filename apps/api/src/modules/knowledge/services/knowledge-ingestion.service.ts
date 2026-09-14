import { prisma } from "@receptionai/db";
import { chunkerService } from "./chunker.service";
import { textExtractor } from "../extractors/text.extractor";
import { pdfExtractor } from "../extractors/pdf.extractor";
import { docxExtractor } from "../extractors/docx.extractor";
import { faqExtractor } from "../extractors/faq.extractor";
import { websiteCrawler } from "./crawler.service";
import { aiKnowledgeCategorizer } from "./ai-categorizer.service";
import { objectStorage } from "./storage.service";
import { EmbeddingProvider } from "../embedding/embedding.interface";
import { OpenAIEmbeddingProvider } from "../embedding/openai-embedding.provider";
import { MockEmbeddingProvider } from "../embedding/mock-embedding.provider";

export class KnowledgeIngestionService {
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
   * Executes the full ingestion and indexing pipeline for a knowledge source.
   * Employs atomic generation switching so existing READY indexes remain available
   * if a reindexing attempt fails.
   */
  async ingestSource(workspaceId: string, sourceId: string): Promise<void> {
    const source = await prisma.knowledgeSource.findFirst({
      where: { id: sourceId, workspaceId },
    });

    if (!source) {
      throw new Error(`KNOWLEDGE_SOURCE_NOT_FOUND: Source '${sourceId}' not found.`);
    }

    if (source.status === "ARCHIVED") {
      throw new Error("KNOWLEDGE_SOURCE_ARCHIVED: Cannot ingest an archived source.");
    }

    // 1. Determine next generation number and create generation record
    const latestGen = await prisma.knowledgeIndexGeneration.findFirst({
      where: { sourceId },
      orderBy: { generation: "desc" },
    });
    const nextGenNum = (latestGen?.generation || 0) + 1;

    const generation = await prisma.knowledgeIndexGeneration.create({
      data: {
        workspaceId,
        sourceId,
        generation: nextGenNum,
        status: "PROCESSING",
        embeddingModel: this.embeddingProvider.model,
      },
    });

    // Mark source as PROCESSING
    await prisma.knowledgeSource.update({
      where: { id: sourceId },
      data: { status: "PROCESSING", errorCode: null, errorMessageSafe: null },
    });

    try {
      // 2. Extract documents based on source type
      const extractedDocs: Array<{ title: string; content: string; url?: string; metadata?: any }> = [];

      switch (source.type) {
        case "MANUAL": {
          const config = (source.configuration as any) || {};
          const rawText = config.content || "";
          const title = config.title || source.name;
          extractedDocs.push({
            title,
            content: rawText,
            metadata: { type: "MANUAL" },
          });
          break;
        }

        case "FAQ": {
          const config = (source.configuration as any) || {};
          const faqItems = config.faqItems || [];
          const docs = faqExtractor.extract(faqItems, source.name);
          extractedDocs.push(...docs);
          break;
        }

        case "TXT":
        case "MARKDOWN": {
          let rawText = "";
          if (source.storageKey) {
            const buf = await objectStorage.get(source.storageKey);
            rawText = buf.toString("utf-8");
          } else {
            rawText = (source.configuration as any)?.content || "";
          }
          const doc = textExtractor.extract(rawText, source.name);
          extractedDocs.push(doc);
          break;
        }

        case "PDF": {
          if (!source.storageKey) {
            throw new Error("KNOWLEDGE_EXTRACTION_FAILED: No file uploaded for PDF source.");
          }
          const buf = await objectStorage.get(source.storageKey);
          const doc = await pdfExtractor.extract(buf, source.name);
          extractedDocs.push(doc);
          break;
        }

        case "DOCX": {
          if (!source.storageKey) {
            throw new Error("KNOWLEDGE_EXTRACTION_FAILED: No file uploaded for DOCX source.");
          }
          const buf = await objectStorage.get(source.storageKey);
          const doc = await docxExtractor.extract(buf, source.name);
          extractedDocs.push(doc);
          break;
        }

        case "WEBSITE": {
          if (!source.sourceUrl) {
            throw new Error("KNOWLEDGE_SOURCE_INVALID_URL: Website source requires sourceUrl.");
          }
          const config = (source.configuration as any) || {};
          // Crawl website thoroughly without restrictive limits
          const pages = await websiteCrawler.crawlWebsite(source.sourceUrl, {
            maxPages: config.maxPages,
            maxDepth: config.maxDepth,
          });

          // Use AI to intelligently analyze, synthesize, and categorize the website facts
          const categorizedDocs = await aiKnowledgeCategorizer.categorizeWebsiteContent(
            pages,
            source.name,
            source.sourceUrl
          );

          for (const catDoc of categorizedDocs) {
            extractedDocs.push({
              title: catDoc.title,
              content: catDoc.content,
              url: source.sourceUrl,
              metadata: {
                category: catDoc.categoryKey,
                summary: catDoc.summary,
                ...catDoc.metadata,
              },
            });
          }
          break;
        }

        default:
          throw new Error(`KNOWLEDGE_SOURCE_UNSUPPORTED_TYPE: Source type '${source.type}' is not supported.`);
      }

      if (extractedDocs.length === 0) {
        throw new Error("KNOWLEDGE_EXTRACTION_FAILED: No documents extracted from source.");
      }

      // 3. Process documents and chunks
      let totalChunks = 0;

      for (const extDoc of extractedDocs) {
        const docHash = chunkerService.hashContent(extDoc.content);

        // Create KnowledgeDocument
        const document = await prisma.knowledgeDocument.create({
          data: {
            workspaceId,
            sourceId,
            generationId: generation.id,
            externalUrl: extDoc.url || null,
            title: extDoc.title,
            mimeType: "text/plain",
            contentHash: docHash,
            status: "ACTIVE",
            metadata: extDoc.metadata || {},
            indexedAt: new Date(),
          },
        });

        // Chunk document
        const chunks = chunkerService.chunkText(extDoc.content, {
          defaultHeadingPath: extDoc.title,
        });

        if (chunks.length > 0) {
          // Embed chunk contents in batches
          const textsToEmbed = chunks.map((c) => c.content);
          const embeddings = await this.embeddingProvider.embedDocuments(textsToEmbed);

          // Store chunks using raw queries for pgvector compatibility
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const vector = embeddings[i];
            const vectorString = `[${vector.join(",")}]`;

            await prisma.$executeRawUnsafe(
              `INSERT INTO "knowledge_chunks" (
                "id", "workspaceId", "sourceId", "documentId", "generationId",
                "chunkIndex", "content", "contentHash", "tokenCount", "headingPath",
                "metadata", "embedding", "embeddingModel", "createdAt", "updatedAt"
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::vector, $13, NOW(), NOW()
              );`,
              `chk_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`,
              workspaceId,
              sourceId,
              document.id,
              generation.id,
              chunk.chunkIndex,
              chunk.content,
              chunk.contentHash,
              chunk.tokenCount,
              chunk.headingPath || null,
              JSON.stringify(chunk.metadata || {}),
              vectorString,
              this.embeddingProvider.model
            );
            totalChunks++;
          }
        }
      }

      // 4. Mark generation as COMPLETED
      await prisma.knowledgeIndexGeneration.update({
        where: { id: generation.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          documentCount: extractedDocs.length,
          chunkCount: totalChunks,
        },
      });

      // 5. Clean up chunks and documents from previous generations for this source
      if (source.activeGenerationId && source.activeGenerationId !== generation.id) {
        await prisma.knowledgeChunk.deleteMany({
          where: { sourceId, generationId: source.activeGenerationId },
        });
        await prisma.knowledgeDocument.updateMany({
          where: { sourceId, generationId: source.activeGenerationId },
          data: { status: "RETIRED" },
        });
      }

      // 6. Atomically update KnowledgeSource to READY with activeGenerationId
      await prisma.knowledgeSource.update({
        where: { id: sourceId },
        data: {
          status: "READY",
          activeGenerationId: generation.id,
          lastIndexedAt: new Date(),
          lastSuccessfulIndexedAt: new Date(),
          errorCode: null,
          errorMessageSafe: null,
        },
      });
    } catch (err: any) {
      console.error(`Ingestion failure for source '${sourceId}':`, err);

      // Record generation failure
      await prisma.knowledgeIndexGeneration.update({
        where: { id: generation.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          errorMessageSafe: err.message,
        },
      });

      // If source previously had a valid generation, keep it READY with warning
      if (source.activeGenerationId) {
        await prisma.knowledgeSource.update({
          where: { id: sourceId },
          data: {
            status: "READY",
            lastIndexedAt: new Date(),
            errorCode: "KNOWLEDGE_REINDEX_PARTIAL_FAILURE",
            errorMessageSafe: `Reindex failed: ${err.message}. Previous index remains active.`,
          },
        });
      } else {
        await prisma.knowledgeSource.update({
          where: { id: sourceId },
          data: {
            status: "FAILED",
            lastIndexedAt: new Date(),
            errorCode: "KNOWLEDGE_INDEX_FAILED",
            errorMessageSafe: err.message,
          },
        });
      }

      throw err;
    }
  }
}

export const knowledgeIngestion = new KnowledgeIngestionService();
