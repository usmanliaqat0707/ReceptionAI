"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Target,
  Search,
  Phone,
  Mail,
  Building,
  Calendar,
  Sparkles,
  ExternalLink,
  Bot,
  CheckCircle2,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Lead {
  id: string;
  intent: string;
  qualification: string | null;
  notes: string | null;
  status: "NEW" | "CONTACTED" | "QUALIFIED" | "WON" | "LOST" | "ARCHIVED";
  source: "VOICE_RECEPTIONIST" | "MANUAL";
  createdAt: string;
  contact: {
    id: string;
    firstName: string;
    lastName: string | null;
    phone: string | null;
    email: string | null;
    company: string | null;
  };
  receptionist?: {
    id: string;
    name: string;
    roleTitle: string;
  } | null;
}

export default function LeadsListPage() {
  const [workspace, setWorkspace] = useState<{ id: string; name: string } | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  useEffect(() => {
    apiFetch<{ memberships: Array<{ role: string; workspace: { id: string; name: string; slug: string } }> }>(
      "/api/v1/auth/me"
    )
      .then((data) => {
        const storedSlug = typeof window !== "undefined" ? localStorage.getItem("rai_active_ws") : null;
        const selected =
          data.memberships.find((m) => m.workspace.slug === storedSlug)?.workspace ||
          data.memberships[0]?.workspace;
        if (selected) {
          setWorkspace(selected);
          loadLeads(selected.id);
        }
      })
      .catch((err) => console.error("Failed to load user workspace:", err));
  }, []);

  const loadLeads = (workspaceId: string, status?: string) => {
    setLoading(true);
    const query = status && status !== "ALL" ? `?status=${status}` : "";
    apiFetch<{ data: Lead[] }>(`/api/v1/workspaces/${workspaceId}/leads${query}`)
      .then((res) => {
        setLeads(res.data || []);
      })
      .catch((err) => console.error("Failed to fetch leads:", err))
      .finally(() => setLoading(false));
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    if (workspace) {
      loadLeads(workspace.id, status);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Target className="w-6 h-6 text-indigo-400" />
            Inquiries & Leads
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Structured business inquiries and qualified leads captured during live voice conversations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-xs font-medium">
            Total: {leads.length}
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto bg-slate-900/60 border border-slate-800/80 p-2 rounded-xl">
        {[
          { label: "All Leads", value: "ALL" },
          { label: "New", value: "NEW" },
          { label: "Contacted", value: "CONTACTED" },
          { label: "Qualified", value: "QUALIFIED" },
          { label: "Won", value: "WON" },
          { label: "Lost", value: "LOST" },
        ].map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => handleStatusFilter(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              statusFilter === tab.value
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Leads Table */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center text-slate-500 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
          <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs">Loading leads...</p>
        </div>
      ) : leads.length === 0 ? (
        <div className="p-16 flex flex-col items-center justify-center text-center text-slate-500 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
          <Target className="w-12 h-12 text-slate-700 mb-3" />
          <h3 className="text-sm font-semibold text-slate-300">No leads recorded</h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1">
            When callers inquire about services or request appointments during voice sessions,
            leads will automatically be registered here.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-medium">
                  <th className="py-3 px-4">Caller Contact</th>
                  <th className="py-3 px-4">Service Intent</th>
                  <th className="py-3 px-4">Qualification Notes</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Receptionist</th>
                  <th className="py-3 px-4">Captured</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="hover:bg-slate-800/30 transition-colors group"
                  >
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/contacts/${lead.contact.id}`}
                        className="font-semibold text-white group-hover:text-indigo-400 transition-colors block"
                      >
                        {lead.contact.firstName} {lead.contact.lastName || ""}
                      </Link>
                      {lead.contact.phone && (
                        <span className="text-[11px] text-slate-400 font-mono">
                          {lead.contact.phone}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-medium text-slate-200 block">
                        {lead.intent}
                      </span>
                      {lead.source === "VOICE_RECEPTIONIST" && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-indigo-400">
                          <Sparkles className="w-2.5 h-2.5" />
                          Voice AI
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-400 max-w-xs truncate">
                      {lead.qualification || <span className="text-slate-600">—</span>}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium tracking-wide uppercase ${
                          lead.status === "NEW"
                            ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/20"
                            : lead.status === "QUALIFIED"
                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
                              : lead.status === "WON"
                                ? "bg-teal-500/15 text-teal-300 border border-teal-500/20"
                                : "bg-slate-800 text-slate-400 border border-slate-700"
                        }`}
                      >
                        {lead.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-400">
                      {lead.receptionist ? (
                        <div className="flex items-center gap-1.5">
                          <Bot className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{lead.receptionist.name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      {new Date(lead.createdAt).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                      >
                        <span>Details</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
