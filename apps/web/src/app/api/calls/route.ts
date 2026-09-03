import { NextResponse } from "next/server";
import { prisma } from "@receptionai/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const outcome = searchParams.get("outcome");
    const receptionistId = searchParams.get("receptionistId");
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const whereClause: any = {
      workspaceId: user.workspaceId,
    };

    if (outcome && outcome !== "ALL") {
      whereClause.primaryOutcome = outcome;
    }

    if (receptionistId) {
      whereClause.receptionistId = receptionistId;
    }

    const calls = await prisma.call.findMany({
      where: whereClause,
      include: {
        receptionist: {
          select: { name: true, role: true },
        },
        participants: true,
        summary: true,
        _count: {
          select: { messages: true, toolExecutions: true },
        },
      },
      orderBy: { startedAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ calls });
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
    const receptionist = await prisma.receptionist.findFirst({
      where: {
        workspaceId: user.workspaceId,
        id: body.receptionistId || undefined,
      },
    });

    if (!receptionist) {
      return NextResponse.json({ error: "Receptionist not found" }, { status: 404 });
    }

    const call = await prisma.call.create({
      data: {
        workspaceId: user.workspaceId,
        receptionistId: receptionist.id,
        callerNumber: body.callerNumber || "+1 (541) 555-0199",
        direction: "inbound",
        status: "ACTIVE",
        startedAt: new Date(),
        answeredAt: new Date(),
        primaryOutcome: "QUESTION_ANSWERED",
      },
      include: {
        receptionist: true,
      },
    });

    // Create caller participant
    await prisma.callParticipant.create({
      data: {
        callId: call.id,
        type: "caller",
        phoneNumber: call.callerNumber,
        displayName: body.callerName || "Browser Caller",
      },
    });

    return NextResponse.json({ call }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
