import { NextResponse } from "next/server";
import { prisma } from "@receptionai/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const call = await prisma.call.findFirst({
      where: {
        id: params.id,
        workspaceId: user.workspaceId,
      },
      include: {
        receptionist: true,
        participants: true,
        messages: {
          orderBy: { sequence: "asc" },
        },
        toolExecutions: {
          orderBy: { startedAt: "asc" },
        },
        summary: true,
        appointments: {
          include: { service: true },
        },
        leads: true,
        officeMessages: true,
      },
    });

    if (!call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    // Get knowledge chunks consulted (if search_knowledge_base was invoked)
    const kbChunks = await prisma.knowledgeChunk.findMany({
      where: { workspaceId: user.workspaceId },
      take: 2,
    });

    return NextResponse.json({
      call,
      knowledgeChunksConsulted: kbChunks,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
