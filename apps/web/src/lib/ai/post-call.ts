import { prisma } from "@receptionai/db";
import { CallOutcome } from "@prisma/client";

export interface ConversationTurn {
  role: "caller" | "assistant" | "system" | "tool";
  text: string;
}

export interface PostCallAnalysis {
  summary: string;
  intent: string;
  primaryOutcome: CallOutcome;
  secondaryOutcomes: string[];
  sentiment: string;
  followUpRequired: boolean;
  topics: string[];
  structuredData: Record<string, any>;
}

export async function analyzeCall(
  callId: string,
  turns: ConversationTurn[],
  toolNamesUsed: string[]
): Promise<PostCallAnalysis> {
  const fullTranscript = turns.map((t) => `${t.role}: ${t.text}`).join("\n");
  const lower = fullTranscript.toLowerCase();

  let primaryOutcome: CallOutcome = CallOutcome.QUESTION_ANSWERED;
  const secondaryOutcomes: string[] = [];
  let intent = "General Inquiry";
  let sentiment = "positive";
  let followUpRequired = false;
  const topics: string[] = [];

  // Determine intent & outcome from transcript and tools
  if (toolNamesUsed.includes("book_appointment") || lower.includes("appointment") || lower.includes("cleaning")) {
    intent = "Appointment Scheduling";
    topics.push("Dental Cleaning", "Scheduling");
    if (toolNamesUsed.includes("book_appointment") || lower.includes("confirmed") || lower.includes("scheduled")) {
      primaryOutcome = CallOutcome.APPOINTMENT_BOOKED;
      secondaryOutcomes.push("calendar_event_created", "sms_dispatched");
    }
  } else if (toolNamesUsed.includes("transfer_call") || lower.includes("emergency") || lower.includes("transfer")) {
    intent = "Emergency Triage / Transfer";
    primaryOutcome = CallOutcome.CALL_TRANSFERRED;
    topics.push("Emergency", "Dr. Vance Transfer");
    followUpRequired = true;
  } else if (toolNamesUsed.includes("take_message") || lower.includes("message") || lower.includes("call back")) {
    intent = "Leave Message";
    primaryOutcome = CallOutcome.MESSAGE_TAKEN;
    topics.push("Message Callback");
    followUpRequired = true;
  } else if (toolNamesUsed.includes("create_lead") || lower.includes("new patient")) {
    intent = "New Patient Registration";
    primaryOutcome = CallOutcome.LEAD_CAPTURED;
    topics.push("New Patient Intake");
  } else if (lower.includes("insurance") || lower.includes("price") || lower.includes("cost")) {
    intent = "Pricing & Insurance Inquiry";
    primaryOutcome = CallOutcome.QUESTION_ANSWERED;
    topics.push("Insurance Verification", "Fee Schedule");
  }

  // Sentiment analysis
  if (lower.includes("unhappy") || lower.includes("angry") || lower.includes("terrible") || lower.includes("pain")) {
    sentiment = lower.includes("pain") ? "urgent" : "negative";
  } else if (lower.includes("great") || lower.includes("thank you") || lower.includes("perfect") || lower.includes("wonderful")) {
    sentiment = "positive";
  } else {
    sentiment = "neutral";
  }

  // Summary generation
  let summary = "";
  if (primaryOutcome === CallOutcome.APPOINTMENT_BOOKED) {
    summary = `Caller inquired about scheduling a dental appointment. The receptionist checked real-time calendar availability, presented matching afternoon slots, and successfully confirmed the booking. A confirmation SMS was triggered.`;
  } else if (primaryOutcome === CallOutcome.CALL_TRANSFERRED) {
    summary = `Caller reported an urgent inquiry requiring human escalation. The receptionist gathered essential preliminary details and initiated a live transfer to the emergency on-call practitioner.`;
  } else if (primaryOutcome === CallOutcome.MESSAGE_TAKEN) {
    summary = `Caller reached out with custom inquiries. The receptionist recorded caller contact information and a detailed message with requested callback time for the office staff.`;
  } else {
    summary = `Caller inquired about clinic operating hours, services, and accepted insurances. The receptionist retrieved approved knowledge base citations and answered all questions accurately.`;
  }

  const analysis: PostCallAnalysis = {
    summary,
    intent,
    primaryOutcome,
    secondaryOutcomes,
    sentiment,
    followUpRequired,
    topics,
    structuredData: {
      transcriptTurnCount: turns.length,
      toolsInvoked: toolNamesUsed,
      analyzedAt: new Date().toISOString(),
    },
  };

  // Persist to Call and CallSummary
  try {
    const call = await prisma.call.findUnique({ where: { id: callId } });
    if (call) {
      await prisma.call.update({
        where: { id: callId },
        data: {
          primaryOutcome,
          sentiment,
          status: "COMPLETED",
        },
      });

      await prisma.callSummary.upsert({
        where: { callId },
        create: {
          workspaceId: call.workspaceId,
          callId,
          summary,
          intent,
          primaryOutcome,
          secondaryOutcomes,
          sentiment,
          followUpRequired,
          structuredData: analysis.structuredData,
        },
        update: {
          summary,
          intent,
          primaryOutcome,
          secondaryOutcomes,
          sentiment,
          followUpRequired,
          structuredData: analysis.structuredData,
        },
      });
    }
  } catch (err) {
    console.warn("Could not save post-call analysis to DB:", err);
  }

  return analysis;
}
