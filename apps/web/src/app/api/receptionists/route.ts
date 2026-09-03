import { NextResponse } from "next/server";
import { prisma } from "@receptionai/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const receptionists = await prisma.receptionist.findMany({
      where: { workspaceId: user.workspaceId },
      include: {
        phoneNumbers: true,
        _count: {
          select: { calls: true, appointments: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ receptionists });
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
    const slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    const receptionist = await prisma.receptionist.create({
      data: {
        workspaceId: user.workspaceId,
        name: body.name,
        slug,
        role: body.role || "Office Receptionist",
        industry: body.industry || "general",
        language: body.language || "en-US",
        greeting: body.greeting || "Hello! How can I assist you today?",
        instructions: body.instructions || "Answer questions and assist callers.",
        voiceConfig: body.voiceConfig || { voice: "alloy", speed: 1.0, style: "friendly" },
        personalityConfig: body.personalityConfig || { traits: ["Professional", "Friendly"], tone: "friendly" },
        createdBy: user.id,
      },
    });

    return NextResponse.json({ receptionist }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
