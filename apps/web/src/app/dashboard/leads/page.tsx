import { prisma } from "@receptionai/db";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import { Users2, DollarSign, ArrowUpRight, CheckCircle2, Bot, Sparkles } from "lucide-react";

export default async function LeadsPage() {
  const user = await getCurrentUser();
  const workspaceId = user?.workspaceId || "ws_bright_dental";

  const leads = await prisma.lead.findMany({
    where: { workspaceId },
    include: {
      contact: true,
      call: { select: { id: true, durationSeconds: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const columns = [
    { id: "NEW", label: "New Inbound Leads", color: "border-blue-500/30 text-blue-400" },
    { id: "QUALIFIED", label: "Qualified by AI", color: "border-purple-500/30 text-purple-400" },
    { id: "CONTACTED", label: "Contacted", color: "border-amber-500/30 text-amber-400" },
    { id: "APPOINTMENT", label: "Appointment Booked", color: "border-emerald-500/30 text-emerald-400" },
    { id: "WON", label: "Closed / Won", color: "border-emerald-500/50 text-emerald-300" },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">Leads & Patient Pipeline</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Prospects captured and qualified during phone calls by Ava.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            {leads.length} Total Opportunities
          </span>
        </div>
      </div>

      {/* Kanban Pipeline Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto pb-4">
        {columns.map((col) => {
          const colLeads = leads.filter((l) => l.status === col.id || (col.id === "NEW" && l.status !== "QUALIFIED" && l.status !== "CONTACTED" && l.status !== "APPOINTMENT" && l.status !== "WON"));

          return (
            <div
              key={col.id}
              className="rounded-2xl bg-slate-900/80 border border-slate-800/80 p-3.5 flex flex-col space-y-3 min-w-[220px]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className={`text-xs font-bold ${col.color}`}>{col.label}</span>
                <span className="w-5 h-5 rounded-full bg-slate-800 text-[10px] font-mono text-slate-300 flex items-center justify-center font-bold">
                  {colLeads.length}
                </span>
              </div>

              {/* Cards List */}
              <div className="space-y-3 flex-1">
                {colLeads.map((lead) => {
                  const leadName = `${lead.contact.firstName} ${lead.contact.lastName || ""}`;
                  return (
                    <div
                      key={lead.id}
                      className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-indigo-500/40 transition shadow-sm space-y-2.5 group"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-200 group-hover:text-indigo-300">
                            {leadName}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">{lead.contact.phone}</div>
                        </div>
                        {lead.estimatedValue && (
                          <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            ${lead.estimatedValue}
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] font-medium text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 truncate">
                        {lead.intent}
                      </div>

                      {lead.notes && (
                        <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">
                          {lead.notes}
                        </p>
                      )}

                      {lead.call && (
                        <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
                          <span>Origin: Voice Call</span>
                          <Link
                            href={`/dashboard/calls/${lead.call.id}`}
                            className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-0.5"
                          >
                            Call <ArrowUpRight className="w-2.5 h-2.5" />
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
