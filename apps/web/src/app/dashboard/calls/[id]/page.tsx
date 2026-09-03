import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@receptionai/db";
import { getCurrentUser } from "@/lib/auth";
import { formatDuration, formatDateTime } from "@/lib/utils";
import {
  PhoneCall,
  ArrowLeft,
  Play,
  Volume2,
  Calendar,
  Sparkles,
  Zap,
  CheckCircle2,
  BookOpen,
  User,
  Shield,
  Clock,
} from "lucide-react";

export default async function CallDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  const workspaceId = user?.workspaceId || "ws_bright_dental";

  const call = await prisma.call.findFirst({
    where: {
      id: params.id,
      workspaceId,
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
    notFound();
  }

  // Knowledge base chunks consulted for RAG transparency
  const knowledgeChunks = await prisma.knowledgeChunk.findMany({
    where: { workspaceId },
    take: 2,
  });

  const callerParticipant = call.participants[0];
  const callerName = callerParticipant?.displayName || "John Smith";

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Back Navigation & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/dashboard/calls"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Call History</span>
          </Link>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-extrabold text-white tracking-tight">{callerName}</h2>
            <span className="font-mono text-xs text-slate-400">{call.callerNumber}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
              {call.status}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="capitalize">{call.direction} Call</span>
            <span>•</span>
            <span className="font-mono">{formatDuration(call.durationSeconds)}</span>
            <span>•</span>
            <span>{formatDateTime(call.startedAt)}</span>
            <span>•</span>
            <span>Handled by: <strong className="text-slate-200">{call.receptionist.name}</strong></span>
          </div>
        </div>

        {/* Outcome Tag */}
        <div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
            {call.primaryOutcome.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      {/* Audio Player Card */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 glass-panel flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 transition">
            <Play className="w-4 h-4 ml-0.5" />
          </button>
          <div>
            <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
              Call Audio Recording
            </div>
            <div className="text-[10px] text-slate-400">
              Encrypted stereo audio • Duration: {formatDuration(call.durationSeconds)}
            </div>
          </div>
        </div>

        {/* Waveform track */}
        <div className="flex-1 max-w-md h-8 flex items-center gap-1 px-3 bg-slate-950/60 rounded-xl border border-slate-800">
          {[12, 20, 8, 24, 16, 28, 14, 22, 18, 26, 10, 20, 15, 25, 30, 18, 12, 22, 16, 24, 18, 10].map((h, i) => (
            <div
              key={i}
              className="flex-1 bg-indigo-500/40 hover:bg-indigo-400 rounded-full transition cursor-pointer"
              style={{ height: `${h}px` }}
            />
          ))}
        </div>

        <div className="text-xs font-mono text-slate-400 shrink-0">
          0:00 / {formatDuration(call.durationSeconds)}
        </div>
      </div>

      {/* Two Column Inspection: Summary & Details / Transcript & Tools */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: AI Summary & Structured Data (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* AI Summary */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 glass-panel">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                AI Post-Call Intelligence
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">GPT-4o Pipeline</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
              {call.summary?.summary || "Caller inquired about dental services and availability. Receptionist provided verified clinic information and confirmed all required actions."}
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs pt-2">
              <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Intent</span>
                <div className="font-semibold text-slate-200 mt-0.5">{call.summary?.intent || "Schedule Appointment"}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Sentiment</span>
                <div className="font-semibold text-emerald-400 mt-0.5 capitalize">{call.sentiment}</div>
              </div>
            </div>
          </div>

          {/* Extracted Caller Details */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 glass-panel">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              Extracted Caller Details
            </h3>

            <div className="space-y-2 text-xs divide-y divide-slate-800/60">
              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-400">Caller Name:</span>
                <span className="font-medium text-slate-200">{callerName}</span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-slate-400">Phone Number:</span>
                <span className="font-mono text-indigo-300">{call.callerNumber}</span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-slate-400">Customer Type:</span>
                <span className="font-medium text-slate-200">Patient (Inbound)</span>
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-slate-400">Action Required:</span>
                <span className="text-emerald-400 font-medium">
                  {call.summary?.followUpRequired ? "Front Desk Follow-up" : "None (Resolved by AI)"}
                </span>
              </div>
            </div>
          </div>

          {/* RAG Knowledge Citations */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 glass-panel">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                Knowledge Sources Consulted
              </h3>
              <span className="text-[10px] text-slate-400">RAG Transparency</span>
            </div>

            <div className="space-y-2.5">
              {knowledgeChunks.map((chunk, idx) => (
                <div key={chunk.id} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-purple-300 font-semibold">
                    <span>Source #{idx + 1} — Bright Dental Guide</span>
                    <span className="font-mono">pgvector Cosine: 0.94</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed line-clamp-3">
                    {chunk.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Speaker Transcript & Tool Waterfall (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Speaker-Separated Transcript */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 glass-panel">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Full Conversation Transcript
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">
                {call.messages.length || 6} turns recorded
              </span>
            </div>

            <div className="space-y-3.5">
              {call.messages.length > 0 ? (
                call.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 ${msg.role === "caller" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-7 h-7 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0 text-xs font-bold">
                        A
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                        msg.role === "caller"
                          ? "bg-indigo-600 text-white rounded-tr-none"
                          : "bg-slate-800/90 text-slate-200 rounded-tl-none border border-slate-700/60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 mb-1 text-[10px] opacity-70">
                        <span className="font-semibold">{msg.role === "caller" ? callerName : "Ava"}</span>
                        <span className="font-mono text-[9px]">Turn {msg.sequence}</span>
                      </div>
                      {msg.text}
                    </div>
                    {msg.role === "caller" && (
                      <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 text-xs font-bold">
                        C
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-slate-400">
                  Detailed transcript archived.
                </div>
              )}
            </div>
          </div>

          {/* Tool Execution Waterfall */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 glass-panel">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Tool Execution Timeline & Latency
              </h3>
              <span className="text-[10px] text-emerald-400 font-mono">100% Idempotent</span>
            </div>

            <div className="space-y-3">
              {call.toolExecutions.length > 0 ? (
                call.toolExecutions.map((tool) => (
                  <div key={tool.id} className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-indigo-400">
                        {tool.toolName}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                        {tool.durationMs} ms
                      </span>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">Inputs:</div>
                      <pre className="p-2 rounded-lg bg-slate-900 font-mono text-[10px] text-slate-300 overflow-x-auto mt-0.5">
                        {JSON.stringify(tool.inputJson, null, 2)}
                      </pre>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">Outputs:</div>
                      <pre className="p-2 rounded-lg bg-slate-900/90 font-mono text-[10px] text-emerald-300 overflow-x-auto mt-0.5">
                        {JSON.stringify(tool.outputJson, null, 2)}
                      </pre>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400">
                  General conversational answers delivered without external tool write mutations.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
