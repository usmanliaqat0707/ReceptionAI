import { NextResponse } from "next/server";
import { prisma } from "@receptionai/db";
import { getCurrentUser } from "@/lib/auth";
import { analyzeCall, ConversationTurn } from "@/lib/ai/post-call";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { messages, durationSeconds, toolNamesUsed } = body;

    const call = await prisma.call.findFirst({
      where: {
        id: params.id,
        workspaceId: user.workspaceId,
      },
    });

    if (!call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    // 1. Save all conversation messages
    if (Array.isArray(messages) && messages.length > 0) {
      // Clear any prior temp messages for this call
      await prisma.callMessage.deleteMany({
        where: { callId: call.id },
      });

      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        await prisma.callMessage.create({
          data: {
            workspaceId: user.workspaceId,
            callId: call.id,
            sequence: i + 1,
            role: msg.role,
            text: msg.text,
            startedAt: new Date(),
          },
        });
      }
    }

    // 2. Update call duration and status
    const endedAt = new Date();
    await prisma.call.update({
      where: { id: call.id },
      data: {
        status: "COMPLETED",
        endedAt,
        durationSeconds: durationSeconds || Math.max(30, Math.floor((endedAt.getTime() - call.startedAt.getTime()) / 1000)),
      },
    });

    // 3. Run Post-Call Intelligence
    const turns: ConversationTurn[] = (messages || []).map((m: any) => ({
      role: m.role,
      text: m.text,
    }));
    const analysis = await analyzeCall(call.id, turns, toolNamesUsed || []);

    return NextResponse.json({
      success: true,
      analysis,
      callId: call.id,
    });
  } catch (error: any) {
    console.error("Error completing call:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
