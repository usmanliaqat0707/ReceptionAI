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

    const receptionist = await prisma.receptionist.findFirst({
      where: {
        id: params.id,
        workspaceId: user.workspaceId,
      },
      include: {
        phoneNumbers: true,
        knowledgeSources: {
          include: {
            knowledgeSource: true,
          },
        },
      },
    });

    if (!receptionist) {
      return NextResponse.json({ error: "Receptionist not found" }, { status: 404 });
    }

    return NextResponse.json({ receptionist });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const receptionist = await prisma.receptionist.updateMany({
      where: {
        id: params.id,
        workspaceId: user.workspaceId,
      },
      data: {
        name: body.name,
        role: body.role,
        industry: body.industry,
        language: body.language,
        status: body.status,
        greeting: body.greeting,
        afterHoursGreeting: body.afterHoursGreeting,
        instructions: body.instructions,
        voiceConfig: body.voiceConfig,
        personalityConfig: body.personalityConfig,
        objectiveConfig: body.objectiveConfig,
        behaviorConfig: body.behaviorConfig,
      },
    });

    const updated = await prisma.receptionist.findUnique({
      where: { id: params.id },
    });

    return NextResponse.json({ receptionist: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
