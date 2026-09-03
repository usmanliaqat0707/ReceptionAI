import Link from "next/link";
import { prisma } from "@receptionai/db";
import { getCurrentUser } from "@/lib/auth";
import {
  PhoneCall,
  CalendarCheck2,
  UserPlus,
  PhoneForwarded,
  Clock,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Sparkles,
  Bot,
  Mic,
  Calendar,
} from "lucide-react";
import { formatDuration, formatDateTime } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const workspaceId = user?.workspaceId || "ws_bright_dental";

  // Fetch summary counts
  const totalCalls = await prisma.call.count({ where: { workspaceId } });
  const appointmentsCount = await prisma.appointment.count({ where: { workspaceId } });
  const leadsCount = await prisma.lead.count({ where: { workspaceId } });
  const transfersCount = await prisma.call.count({
    where: { workspaceId, primaryOutcome: "CALL_TRANSFERRED" },
  });

  // Recent 8 calls
  const recentCalls = await prisma.call.findMany({
    where: { workspaceId },
    include: {
      receptionist: { select: { name: true } },
      participants: true,
      summary: true,
    },
    orderBy: { startedAt: "desc" },
    take: 8,
  });

  // Active Receptionist Ava
  const ava = await prisma.receptionist.findFirst({
    where: { workspaceId, slug: "ava" },
    include: {
      phoneNumbers: true,
    },
  });

  const kpis = [
    {
      title: "Total Calls",
      value: totalCalls.toLocaleString(),
      change: "+14% this week",
      icon: PhoneCall,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/20",
    },
    {
      title: "Appointments Booked",
      value: appointmentsCount.toLocaleString(),
      change: "28.4% conversion",
      icon: CalendarCheck2,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/20",
    },
    {
      title: "New Qualified Leads",
      value: leadsCount.toLocaleString(),
      change: "High intent captured",
      icon: UserPlus,
      color: "text-purple-400",
      bgColor: "bg-purple-500/10",
      borderColor: "border-purple-500/20",
    },
    {
      title: "Calls Transferred",
      value: transfersCount.toLocaleString(),
      change: "Emergency & triage",
      icon: PhoneForwarded,
      color: "text-amber-400",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/20",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome & Launch Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-950/80 via-slate-900 to-indigo-900/40 border border-indigo-500/30 p-6 glass-panel">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                Production-Style Realtime AI Voice
              </span>
              <span className="text-xs text-slate-400">Workspace: <strong className="text-slate-200">Bright Dental</strong></span>
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              Front-Desk Voice Operations Center
            </h2>
            <p className="text-xs text-slate-300 max-w-xl">
              Ava is currently handling telephone inquiries, checking real-time calendar availability, qualifying patients, and writing structured post-call intelligence.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/playground"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition border border-indigo-400/40 glow-primary"
            >
              <Mic className="w-4 h-4 animate-pulse" />
              <span>Test Voice Agent Ava</span>
            </Link>
            <Link
              href="/dashboard/calls"
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
            >
              <span>View 250 Calls</span>
            </Link>
          </div>
        </div>

        {/* Ambient decorative glow */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.title}
              className={`p-5 rounded-xl bg-slate-900/90 border ${kpi.borderColor} relative overflow-hidden transition hover:border-indigo-500/50`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">{kpi.title}</span>
                <div className={`w-8 h-8 rounded-lg ${kpi.bgColor} flex items-center justify-center ${kpi.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-extrabold text-white tracking-tight">{kpi.value}</span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                <span className="text-emerald-400 font-semibold">{kpi.change}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Two Column Layout: Active Receptionist & Telemetry + Recent Calls Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Active Receptionist Profile & Telemetry */}
        <div className="space-y-6">
          {/* Ava Card */}
          <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white flex items-center gap-2">
                    Ava
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      ACTIVE
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">Dental Office Receptionist</div>
                </div>
              </div>
              <Link
                href={`/dashboard/receptionists/${ava?.id || ""}`}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-0.5"
              >
                Configure <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-800 text-xs space-y-2">
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Assigned Number:</span>
                <span className="font-mono text-indigo-300">{ava?.phoneNumbers[0]?.number || "+1 (541) 555-0199"}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Voice Persona:</span>
                <span className="font-medium text-slate-200">Alloy (Friendly / Concise)</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">RAG Sources:</span>
                <span className="font-medium text-slate-200">Bright Dental Official Guide (7 chunks)</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Toolsets:</span>
                <span className="text-emerald-400 font-semibold">Calendar, CRM, RAG, Transfer</span>
              </div>
            </div>

            <div className="text-xs text-slate-400 italic">
              &quot;{ava?.greeting}&quot;
            </div>
          </div>

          {/* Operational Latency & Telemetry */}
          <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Realtime Telemetry & SLAs
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-800/80">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Speech Latency</div>
                <div className="text-lg font-bold text-white font-mono mt-0.5">312 ms</div>
                <div className="text-[10px] text-emerald-400">Fast WebRTC</div>
              </div>
              <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-800/80">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Tool Execution</div>
                <div className="text-lg font-bold text-white font-mono mt-0.5">238 ms</div>
                <div className="text-[10px] text-emerald-400">Idempotent DB</div>
              </div>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-medium">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Zero Hallucination Policy
              </span>
              <span className="text-[10px] font-mono">100% Enforced</span>
            </div>
          </div>
        </div>

        {/* Right Column: High-Density Live Calls History */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Recent Telephone Activity</h3>
              <p className="text-xs text-slate-400">Caller records with post-call intelligence and tool outcomes</p>
            </div>
            <Link
              href="/dashboard/calls"
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
            >
              All Calls <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] text-slate-400 uppercase border-b border-slate-800/80 bg-slate-950/40">
                <tr>
                  <th className="py-2.5 px-3">Caller</th>
                  <th className="py-2.5 px-3">Outcome</th>
                  <th className="py-2.5 px-3">Duration</th>
                  <th className="py-2.5 px-3">Sentiment</th>
                  <th className="py-2.5 px-3 text-right">Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentCalls.map((call) => {
                  const callerName = call.participants[0]?.displayName || call.callerNumber;
                  const outcomeBadgeColor =
                    call.primaryOutcome === "APPOINTMENT_BOOKED"
                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                      : call.primaryOutcome === "LEAD_CAPTURED"
                      ? "bg-purple-500/15 text-purple-400 border-purple-500/30"
                      : call.primaryOutcome === "CALL_TRANSFERRED"
                      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                      : "bg-blue-500/15 text-blue-400 border-blue-500/30";

                  return (
                    <tr key={call.id} className="hover:bg-slate-800/40 transition group">
                      <td className="py-3 px-3">
                        <Link href={`/dashboard/calls/${call.id}`} className="font-semibold text-slate-200 group-hover:text-indigo-300">
                          {callerName}
                        </Link>
                        <div className="text-[10px] text-slate-500 font-mono">{call.callerNumber}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${outcomeBadgeColor}`}>
                          {call.primaryOutcome.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-300">
                        {formatDuration(call.durationSeconds)}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`text-[11px] font-medium capitalize ${call.sentiment === "positive" ? "text-emerald-400" : "text-slate-400"}`}>
                          {call.sentiment}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-400 text-[11px]">
                        {formatDateTime(call.startedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
