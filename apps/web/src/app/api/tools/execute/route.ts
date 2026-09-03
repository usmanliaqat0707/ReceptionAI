import { NextResponse } from "next/server";
import { executeTool } from "@/lib/tools";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { toolName, parameters, receptionistId, callId, callerNumber } = body;

    if (!toolName) {
      return NextResponse.json({ error: "toolName is required" }, { status: 400 });
    }

    const result = await executeTool(toolName, parameters || {}, {
      workspaceId: user.workspaceId,
      receptionistId: receptionistId || "default",
      callId,
      callerNumber,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Tool execution error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to execute tool" },
      { status: 500 }
    );
  }
}
