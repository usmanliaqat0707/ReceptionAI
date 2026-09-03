import Link from "next/link";
import { prisma } from "@receptionai/db";
import { getCurrentUser } from "@/lib/auth";
import { formatDuration, formatDateTime } from "@/lib/utils";
import { PhoneCall, Search, Filter, ArrowUpRight, CheckCircle2, Clock } from "lucide-react";

export default async function CallsPage({
  searchParams,
}: {
  searchParams: { outcome?: string; query?: string };
}) {
  const user = await getCurrentUser();
  const workspaceId = user?.workspaceId || "ws_bright_dental";

  const selectedOutcome = searchParams.outcome;

  const whereClause: any = {
    workspaceId,
  };

  if (selectedOutcome && selectedOutcome !== "ALL") {
    whereClause.primaryOutcome = selectedOutcome;
  }

  const calls = await prisma.call.findMany({
    where: whereClause,
    include: {
      receptionist: { select: { name: true } },
      participants: true,
      summary: true,
      _count: {
        select: { messages: true, toolExecutions: true },
      },
    },
    orderBy: { startedAt: "desc" },
    take: 100,
  });

  const outcomes = [
    { label: "All Calls", value: "ALL" },
    { label: "Booked", value: "APPOINTMENT_BOOKED" },
    { label: "Q&A Answered", value: "QUESTION_ANSWERED" },
    { label: "Leads Captured", value: "LEAD_CAPTURED" },
    { label: "Transferred", value: "CALL_TRANSFERRED" },
    { label: "Messages Taken", value: "MESSAGE_TAKEN" },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header & Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">Telephone Call History</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Full record of inbound phone inquiries, transcripts, tool actions, and AI summaries.
          </p>
        </div>

        {/* Outcome Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800">
          {outcomes.map((o) => {
            const isSelected = (!selectedOutcome && o.value === "ALL") || selectedOutcome === o.value;
            return (
              <Link
                key={o.value}
                href={o.value === "ALL" ? "/dashboard/calls" : `/dashboard/calls?outcome=${o.value}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  isSelected
                    ? "bg-indigo-600 text-white font-semibold shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}
              >
                {o.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* High-Density Calls Table */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden glass-panel">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] text-slate-400 uppercase border-b border-slate-800/80 bg-slate-950/60">
              <tr>
                <th className="py-3 px-4">Caller</th>
                <th className="py-3 px-4">Receptionist</th>
                <th className="py-3 px-4">Outcome</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Sentiment</th>
                <th className="py-3 px-4">Intent</th>
                <th className="py-3 px-4">Started At</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {calls.map((call) => {
                const callerName = call.participants[0]?.displayName || call.callerNumber;
                const outcomeColor =
                  call.primaryOutcome === "APPOINTMENT_BOOKED"
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                    : call.primaryOutcome === "LEAD_CAPTURED"
                    ? "bg-purple-500/15 text-purple-400 border-purple-500/30"
                    : call.primaryOutcome === "CALL_TRANSFERRED"
                    ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                    : "bg-blue-500/15 text-blue-400 border-blue-500/30";

                return (
                  <tr key={call.id} className="hover:bg-slate-800/40 transition group">
                    <td className="py-3.5 px-4">
                      <Link href={`/dashboard/calls/${call.id}`} className="font-semibold text-slate-200 group-hover:text-indigo-300">
                        {callerName}
                      </Link>
                      <div className="text-[10px] text-slate-500 font-mono">{call.callerNumber}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {call.receptionist.name}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${outcomeColor}`}>
                        {call.primaryOutcome.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      {formatDuration(call.durationSeconds)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`text-[11px] capitalize ${call.sentiment === "positive" ? "text-emerald-400" : "text-slate-400"}`}>
                        {call.sentiment}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 max-w-[180px] truncate">
                      {call.summary?.intent || "General Inquiry"}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                      {formatDateTime(call.startedAt)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/dashboard/calls/${call.id}`}
                        className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white font-medium text-[11px] transition inline-flex items-center gap-1"
                      >
                        Inspect <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
