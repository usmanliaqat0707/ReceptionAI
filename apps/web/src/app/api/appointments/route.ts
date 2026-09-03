import { NextResponse } from "next/server";
import { prisma } from "@receptionai/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appointments = await prisma.appointment.findMany({
      where: { workspaceId: user.workspaceId },
      include: {
        contact: true,
        service: true,
        receptionist: { select: { name: true } },
      },
      orderBy: { startAt: "desc" },
    });

    return NextResponse.json({ appointments });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
