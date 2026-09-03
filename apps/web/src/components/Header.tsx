"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";

export function Header() {
  const pathname = usePathname();

  const getTitle = () => {
    if (pathname === "/dashboard") return "Workspace Overview";
    if (pathname.startsWith("/receptionists")) return "AI Receptionists";
    if (pathname.startsWith("/calls")) return "Call Logs";
    if (pathname.startsWith("/contacts")) return "Contacts Directory";
    if (pathname.startsWith("/leads")) return "Leads Pipeline";
    if (pathname.startsWith("/appointments")) return "Appointments Calendar";
    if (pathname.startsWith("/knowledge")) return "Knowledge Base";
    if (pathname.startsWith("/integrations")) return "Integrations";
    if (pathname.startsWith("/analytics")) return "Telemetry & Analytics";
    if (pathname.startsWith("/settings/workspace")) return "Settings — Workspace";
    if (pathname.startsWith("/settings/team")) return "Settings — Team Members";
    if (pathname.startsWith("/settings/security")) return "Settings — Security & Sessions";
    if (pathname.startsWith("/settings/audit-log")) return "Settings — Audit Log";
    return "ReceptionAI";
  };

  return (
    <header className="h-14 border-b border-slate-800 bg-[#0c121e]/80 backdrop-blur px-8 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-400 font-medium">Dashboard</span>
        <span className="text-slate-600">/</span>
        <span className="text-white font-semibold">{getTitle()}</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Tenant Isolated</span>
        </div>
      </div>
    </header>
  );
}
