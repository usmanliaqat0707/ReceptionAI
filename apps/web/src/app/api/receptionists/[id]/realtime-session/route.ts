import { NextResponse } from "next/server";
import { prisma } from "@receptionai/db";
import { getCurrentUser } from "@/lib/auth";
import { compileReceptionistPrompt } from "@/lib/ai/prompts";
import { AVAILABLE_TOOLS } from "@/lib/tools";

export async function POST(
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
        workspace: true,
      },
    });

    if (!receptionist) {
      return NextResponse.json({ error: "Receptionist not found" }, { status: 404 });
    }

    // Compile layered system prompt
    const systemPrompt = compileReceptionistPrompt({
      receptionistName: receptionist.name,
      role: receptionist.role,
      industry: receptionist.industry,
      greeting: receptionist.greeting,
      instructions: receptionist.instructions,
      personalityTraits: (receptionist.personalityConfig as any)?.traits || ["Professional", "Warm"],
      tone: (receptionist.personalityConfig as any)?.tone || "friendly",
      businessName: receptionist.workspace.name,
      businessHours: "Monday - Friday 8:30 AM - 5:30 PM, Saturday 9:00 AM - 2:00 PM",
      currentLocalTime: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    });

    const openaiApiKey = process.env.OPENAI_API_KEY;

    // If OpenAI API key is configured, create an ephemeral Realtime session token
    if (openaiApiKey && openaiApiKey.startsWith("sk-")) {
      try {
        const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-realtime-preview-2024-12-17",
            voice: (receptionist.voiceConfig as any)?.voice || "alloy",
            instructions: systemPrompt,
            tools: AVAILABLE_TOOLS.map((t) => ({
              type: "function",
              name: t.name,
              description: t.description,
              parameters: t.parameters,
            })),
            input_audio_transcription: {
              model: "whisper-1",
            },
            turn_detection: {
              type: "server_vad",
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
            },
          }),
        });

        if (response.ok) {
          const sessionData = await response.json();
          return NextResponse.json({
            mode: "webrtc",
            session: sessionData,
            receptionist: {
              id: receptionist.id,
              name: receptionist.name,
              greeting: receptionist.greeting,
              voice: (receptionist.voiceConfig as any)?.voice || "alloy",
            },
          });
        }
      } catch (err) {
        console.warn("OpenAI ephemeral session request failed, falling back to simulation:", err);
      }
    }

    // High-Fidelity Simulation Mode (Instant, zero-key dependency, portfolio-ready)
    return NextResponse.json({
      mode: "simulation",
      session: {
        id: `sim_sess_${Date.now()}`,
        client_secret: { value: "simulation_token_valid" },
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      },
      systemPrompt,
      receptionist: {
        id: receptionist.id,
        name: receptionist.name,
        role: receptionist.role,
        greeting: receptionist.greeting,
        voice: (receptionist.voiceConfig as any)?.voice || "alloy",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
