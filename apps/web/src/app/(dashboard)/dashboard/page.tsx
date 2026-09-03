"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Badge, Button } from "@receptionai/ui";
import {
  CheckCircle2,
  Circle,
  Building2,
  Users,
  ShieldAlert,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface CurrentData {
  user: { name: string; email: string };
  memberships: Array<{
    role: string;
    workspace: { id: string; name: string; slug: string; timezone: string; industry: string };
  }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<CurrentData | null>(null);

  useEffect(() => {
    apiFetch<CurrentData>("/api/v1/auth/me")
      .then(setData)
      .catch(() => {});
  }, []);

  const activeWs = data?.memberships[0]?.workspace;
  const userRole = data?.memberships[0]?.role;

  const checklistItems = [
    { title: "Create Owner Account", completed: true, phase: "Phase 0" },
    { title: "Initialize Workspace & Timezone", completed: true, phase: "Phase 1" },
    {
      title: "Invite Team Members & Set Roles",
      completed: false,
      phase: "Phase 1",
      link: "/settings/team",
    },
    { title: "Create First AI Receptionist", completed: false, phase: "Phase 2" },
    { title: "Index Business Knowledge Base", completed: false, phase: "Phase 2" },
    { title: "Connect Telephony & Inbound Numbers", completed: false, phase: "Phase 3" },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                Phase 1 Core Architecture
              </span>
              <Badge variant="success">Active Workspace</Badge>
            </div>
            <h1 className="mt-1 text-xl font-bold text-white tracking-tight">
              Welcome back, {data?.user.name || "Administrator"}
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Operating workspace:{" "}
              <span className="text-slate-200 font-medium">
                {activeWs?.name || "Bright Dental"}
              </span>{" "}
              ({activeWs?.industry || "Dental Clinic"}) • Role:{" "}
              <span className="text-indigo-400 font-medium">{userRole || "OWNER"}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/settings/team">
              <Button size="sm" variant="secondary">
                <Users className="h-3.5 w-3.5 mr-1.5" />
                Manage Team
              </Button>
            </Link>
            <Link href="/settings/workspace">
              <Button size="sm">
                <Building2 className="h-3.5 w-3.5 mr-1.5" />
                Workspace Settings
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Setup Checklist & Architectural Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Onboarding Checklist */}
        <Card className="lg:col-span-2 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white">System Deployment Progress</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Production setup checklist for your AI Voice Receptionist workspace.
            </p>
          </div>

          <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
            {checklistItems.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 flex items-center justify-between hover:bg-slate-900/30 transition"
              >
                <div className="flex items-center gap-3">
                  {item.completed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-slate-600 shrink-0" />
                  )}
                  <div>
                    <p
                      className={`text-xs font-medium ${
                        item.completed ? "text-slate-300" : "text-slate-400"
                      }`}
                    >
                      {item.title}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={item.completed ? "success" : "default"}>{item.phase}</Badge>
                  {item.link && (
                    <Link
                      href={item.link}
                      className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium ml-2"
                    >
                      Configure <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Security & Architecture Highlights */}
        <div className="space-y-4">
          <Card className="space-y-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-indigo-400" />
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                Tenant Isolation Guard
              </h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every database query and API endpoint enforces server-side workspace boundaries.
              Knowledge of another workspace&apos;s ID or slug never grants access.
            </p>
            <div className="pt-2 border-t border-slate-800">
              <Link
                href="/settings/audit-log"
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1"
              >
                View Workspace Audit Log →
              </Link>
            </div>
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <h4 className="text-xs font-semibold text-white uppercase tracking-wider">
                Phase 2 Voice Receptionist
              </h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Phase 0 (Engineering Foundation) & Phase 1 (SaaS Core) are active. AI Receptionist
              configuration, personality tuning, and instructions will unlock in Phase 2.
            </p>
            <div className="pt-2 border-t border-slate-800">
              <Link
                href="/receptionists"
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1"
              >
                Inspect Receptionists Module →
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
