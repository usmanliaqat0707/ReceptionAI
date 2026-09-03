import { NextResponse } from "next/server";
import { prisma } from "@receptionai/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sources = await prisma.knowledgeSource.findMany({
      where: { workspaceId: user.workspaceId },
      include: {
        documents: {
          include: {
            chunks: true,
          },
        },
      },
    });

    const totalChunks = await prisma.knowledgeChunk.count({
      where: { workspaceId: user.workspaceId },
    });

    return NextResponse.json({ sources, totalChunks });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { query } = body;

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const chunks = await prisma.knowledgeChunk.findMany({
      where: { workspaceId: user.workspaceId },
      include: { document: true },
    });

    const searchWords = query.toLowerCase().split(/\s+/).filter(Boolean);
    const scoredChunks = chunks.map((chunk) => {
      let score = 0.45;
      for (const word of searchWords) {
        if (chunk.content.toLowerCase().includes(word)) score += 0.2;
      }
      return {
        id: chunk.id,
        content: chunk.content,
        documentTitle: chunk.document?.title || "Guide",
        score: Math.min(0.98, Number(score.toFixed(2))),
        metadata: chunk.metadata,
      };
    });

    scoredChunks.sort((a, b) => b.score - a.score);

    return NextResponse.json({ results: scoredChunks.slice(0, 4) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
