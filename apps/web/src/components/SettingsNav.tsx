"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Users, ShieldCheck, ScrollText } from "lucide-react";

export function SettingsNav() {
  const pathname = usePathname();

  const tabs = [
    { label: "Workspace Details", href: "/settings/workspace", icon: Building2 },
    { label: "Team Members", href: "/settings/team", icon: Users },
    { label: "Security & Sessions", href: "/settings/security", icon: ShieldCheck },
    { label: "Audit Log", href: "/settings/audit-log", icon: ScrollText },
  ];

  return (
    <div className="flex border-b border-slate-800 space-x-1 mb-6">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 -mb-px transition ${
              isActive
                ? "border-indigo-500 text-indigo-400 font-semibold"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
