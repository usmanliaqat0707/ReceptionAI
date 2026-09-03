import { NextResponse } from "next/server";
import { prisma } from "@receptionai/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const leads = await prisma.lead.findMany({
      where: { workspaceId: user.workspaceId },
      include: {
        contact: true,
        call: {
          select: { id: true, startedAt: true, durationSeconds: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ leads });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
