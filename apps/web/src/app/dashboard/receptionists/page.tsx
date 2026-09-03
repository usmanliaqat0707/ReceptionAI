import Link from "next/link";
import { prisma } from "@receptionai/db";
import { getCurrentUser } from "@/lib/auth";
import { Bot, Mic, Plus, ArrowUpRight, Phone, CheckCircle2, Sliders } from "lucide-react";

export default async function ReceptionistsPage() {
  const user = await getCurrentUser();
  const workspaceId = user?.workspaceId || "ws_bright_dental";

  const receptionists = await prisma.receptionist.findMany({
    where: { workspaceId },
    include: {
      phoneNumbers: true,
      _count: {
        select: { calls: true, appointments: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">AI Receptionists</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure natural voice personas, personality traits, system instructions, and tool capabilities.
          </p>
        </div>

        <Link
          href="/dashboard/playground"
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-2 glow-primary self-start"
        >
          <Mic className="w-4 h-4" />
          <span>Launch Voice Test</span>
        </Link>
      </div>

      {/* Receptionists Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {receptionists.map((rec) => {
          const voiceCfg = rec.voiceConfig as any;
          const personality = rec.personalityConfig as any;

          return (
            <div
              key={rec.id}
              className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 transition glass-panel flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                    <Bot className="w-6 h-6" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
                    {rec.status}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white">{rec.name}</h3>
                  <p className="text-xs text-indigo-400 font-medium">{rec.role}</p>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{rec.description}</p>
                </div>

                {/* Configuration Specs */}
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Voice Model:</span>
                    <span className="font-semibold text-slate-200 capitalize">{voiceCfg?.voice || "alloy"}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Phone Line:</span>
                    <span className="font-mono text-indigo-300">{rec.phoneNumbers[0]?.number || "Virtual SIP"}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Total Calls Handled:</span>
                    <span className="font-bold text-slate-200">{rec._count.calls} calls</span>
                  </div>
                </div>

                {/* Traits */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {(personality?.traits || ["Professional", "Friendly", "Concise"]).map((t: string) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[10px] text-slate-300 font-medium"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <Link
                  href={`/dashboard/receptionists/${rec.id}`}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  Configure Receptionist
                </Link>

                <Link
                  href="/dashboard/playground"
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition flex items-center gap-1"
                >
                  <Mic className="w-3 h-3 text-indigo-400" />
                  Test Voice
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
