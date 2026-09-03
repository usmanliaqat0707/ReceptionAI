"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Mic,
  Bot,
  PhoneCall,
  CalendarDays,
  Users2,
  Contact,
  BookOpen,
  BarChart3,
  Settings,
  Sparkles,
  ChevronDown,
  Building2,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Voice Playground", href: "/dashboard/playground", icon: Mic, badge: "TEST" },
  { name: "AI Receptionists", href: "/dashboard/receptionists", icon: Bot },
  { name: "Call History", href: "/dashboard/calls", icon: PhoneCall },
  { name: "Appointments", href: "/dashboard/appointments", icon: CalendarDays },
  { name: "Leads Pipeline", href: "/dashboard/leads", icon: Users2 },
  { name: "Contacts", href: "/dashboard/contacts", icon: Contact },
  { name: "Knowledge Base", href: "/dashboard/knowledge", icon: BookOpen },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [workspace, setWorkspace] = useState("Bright Dental");
  const [showWsMenu, setShowWsMenu] = useState(false);

  return (
    <aside className="w-64 border-r border-slate-800/80 bg-[#0d1322] flex flex-col shrink-0 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-5 border-b border-slate-800/80 justify-between">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Mic className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
              Reception<span className="text-indigo-400 font-extrabold">AI</span>
            </span>
            <span className="text-[10px] text-slate-400 tracking-wider uppercase block font-medium">Enterprise SaaS</span>
          </div>
        </Link>
      </div>

      {/* Workspace Switcher */}
      <div className="p-3 border-b border-slate-800/60 relative">
        <button
          onClick={() => setShowWsMenu(!showWsMenu)}
          className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition text-left"
        >
          <div className="flex items-center gap-2.5 truncate">
            <div className="w-7 h-7 rounded-md bg-indigo-950 border border-indigo-700/50 flex items-center justify-center text-indigo-400">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="truncate">
              <div className="text-xs font-semibold text-slate-200 truncate">{workspace}</div>
              <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Active Line
              </div>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        </button>

        {showWsMenu && (
          <div className="absolute top-16 left-3 right-3 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-1.5 space-y-1">
            <button
              onClick={() => {
                setWorkspace("Bright Dental");
                setShowWsMenu(false);
              }}
              className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-slate-800 flex items-center justify-between text-slate-200"
            >
              <span>Bright Dental (Ava)</span>
              {workspace === "Bright Dental" && <span className="text-indigo-400 font-bold">✓</span>}
            </button>
            <button
              onClick={() => {
                setWorkspace("Sterling Legal Partners");
                setShowWsMenu(false);
              }}
              className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-slate-800 flex items-center justify-between text-slate-400 hover:text-slate-200"
            >
              <span>Sterling Legal (Emma)</span>
              {workspace === "Sterling Legal Partners" && <span className="text-indigo-400 font-bold">✓</span>}
            </button>
          </div>
        )}
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition group",
                isActive
                  ? "bg-indigo-600/15 text-indigo-400 border border-indigo-500/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className={cn("w-4 h-4 transition", isActive ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-300")} />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer / User Profile */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-900/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-indigo-300">
              MV
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-200">Dr. Marcus Vance</div>
              <div className="text-[10px] text-slate-500">Workspace Owner</div>
            </div>
          </div>
          <div className="flex items-center text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-[10px] font-medium" title="Tenant Isolation Active">
            <ShieldCheck className="w-3 h-3 mr-1" />
            SOC2
          </div>
        </div>
      </div>
    </aside>
  );
}
