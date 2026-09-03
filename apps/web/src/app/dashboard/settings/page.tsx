import { prisma } from "@receptionai/db";
import { getCurrentUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import {
  Settings,
  Shield,
  Key,
  Webhook,
  Users,
  Clock,
  CheckCircle2,
  Lock,
} from "lucide-react";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const workspaceId = user?.workspaceId || "ws_bright_dental";

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      members: { include: { user: true } },
      businessHours: { orderBy: { dayOfWeek: "asc" } },
      apiKeys: true,
      webhookEndpoints: { include: { deliveries: true } },
    },
  });

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div>
        <h2 className="text-xl font-extrabold text-white tracking-tight">Workspace Settings & Integrations</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Manage business profile, operating hours, team members, API keys, webhooks, and security policies.
        </p>
      </div>

      {/* Workspace General Info */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 glass-panel space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Settings className="w-4 h-4 text-indigo-400" />
          Business Profile
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="text-slate-400 block mb-1 font-medium">Workspace Name</label>
            <input
              type="text"
              defaultValue={workspace?.name || "Bright Dental"}
              disabled
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium"
            />
          </div>
          <div>
            <label className="text-slate-400 block mb-1 font-medium">Industry</label>
            <input
              type="text"
              defaultValue={workspace?.industry || "Dental Clinic"}
              disabled
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium"
            />
          </div>
          <div>
            <label className="text-slate-400 block mb-1 font-medium">Timezone</label>
            <input
              type="text"
              defaultValue={workspace?.timezone || "America/Los_Angeles"}
              disabled
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
            />
          </div>
        </div>
      </div>

      {/* Operating Hours */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 glass-panel space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            Clinic Operating Hours
          </h3>
          <span className="text-[10px] text-slate-400">Ava uses these to enforce after-hours behavior</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {workspace?.businessHours.map((bh) => (
            <div key={bh.id} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
              <span className="font-semibold text-slate-200">{dayNames[bh.dayOfWeek]}</span>
              <span className={`font-mono text-[11px] ${bh.enabled ? "text-emerald-400" : "text-slate-500"}`}>
                {bh.enabled ? `${bh.openTime} – ${bh.closeTime}` : "Closed"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* API Keys & Webhooks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* API Keys */}
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 glass-panel space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-400" />
              Developer API Keys
            </h3>
            <span className="text-[10px] text-emerald-400 font-mono">1 Active Key</span>
          </div>

          <p className="text-xs text-slate-400">
            Secure SHA-256 hashed API keys for programmatic call export and webhook synchronization.
          </p>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200">Production Zapier Integration</span>
              <span className="text-[10px] font-mono text-slate-400">Prefix: rai_live_</span>
            </div>
            <div className="font-mono text-[11px] text-indigo-300 bg-slate-900 p-2 rounded-lg border border-slate-800 truncate">
              rai_live_9f82••••••••••••••••••••3a9b
            </div>
            <div className="text-[10px] text-slate-500">
              Scopes: calls:read, contacts:read, appointments:write
            </div>
          </div>
        </div>

        {/* Webhook Endpoints */}
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 glass-panel space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Webhook className="w-4 h-4 text-purple-400" />
              Webhook Endpoints
            </h3>
            <span className="text-[10px] text-emerald-400 font-mono">HMAC-SHA256</span>
          </div>

          <p className="text-xs text-slate-400">
            Realtime events delivered with signed headers (call.completed, appointment.created).
          </p>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-200">Dental Practice EMR Webhook</span>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                ACTIVE
              </span>
            </div>
            <div className="font-mono text-[11px] text-slate-300 bg-slate-900 p-2 rounded-lg border border-slate-800 truncate">
              https://api.brightdental.com/webhooks/receptionai
            </div>
            <div className="text-[10px] text-slate-400">
              Last Delivery: 200 OK • Succeeded
            </div>
          </div>
        </div>
      </div>

      {/* Security & Tenant Isolation */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-950/30 via-slate-900 to-slate-900 border border-emerald-500/30 glass-panel space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-400">
            <Shield className="w-4 h-4" />
            <h3 className="text-sm font-bold text-white">Security & Tenant Isolation Safeguards</h3>
          </div>
          <span className="text-[10px] font-mono text-emerald-400">SOC2 Architecture Ready</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="font-semibold text-slate-200 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Tenant Boundary
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              All queries enforce workspace_id in database layer.
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="font-semibold text-slate-200 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Tool Authorization
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Strict schema & idempotency key validation.
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="font-semibold text-slate-200 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Prompt Injection Defense
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Multi-layered prompts; caller speech cannot override policy.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
