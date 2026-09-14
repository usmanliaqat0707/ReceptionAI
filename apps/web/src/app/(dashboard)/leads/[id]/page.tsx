"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Target,
  Users,
  Phone,
  Mail,
  Building,
  Bot,
  Calendar,
  Sparkles,
  CheckCircle2,
  Clock,
  Edit2,
  Check,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const leadId = params.id;
  const [workspace, setWorkspace] = useState<{ id: string; name: string } | null>(null);
  const [lead, setLead] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

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
          loadLead(selected.id);
        }
      })
      .catch((err) => console.error("Failed to load user workspace:", err));
  }, [leadId]);

  const loadLead = (workspaceId: string) => {
    setLoading(true);
    apiFetch<{ data: any }>(`/api/v1/workspaces/${workspaceId}/leads/${leadId}`)
      .then((res) => {
        setLead(res.data);
      })
      .catch((err) => console.error("Failed to fetch lead details:", err))
      .finally(() => setLoading(false));
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!workspace) return;
    setUpdating(true);
    try {
      const res = await apiFetch<{ data: any }>(
        `/api/v1/workspaces/${workspace.id}/leads/${leadId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: newStatus }),
        }
      );
      setLead((prev: any) => ({ ...prev, status: newStatus }));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 flex flex-col items-center justify-center text-slate-500 max-w-4xl mx-auto">
        <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs">Loading inquiry details...</p>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-16 flex flex-col items-center justify-center text-center text-slate-500 max-w-4xl mx-auto">
        <Target className="w-12 h-12 text-slate-700 mb-3" />
        <h3 className="text-sm font-semibold text-slate-300">Lead not found</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
          This inquiry record could not be found in the current workspace.
        </p>
        <Link
          href="/leads"
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium"
        >
          Back to Leads
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back button */}
      <div>
        <Link
          href="/leads"
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Leads</span>
        </Link>
      </div>

      {/* Main Detail Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-white">{lead.intent}</h1>
              {lead.source === "VOICE_RECEPTIONIST" ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Sparkles className="w-3 h-3" />
                  Voice AI Lead
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                  Manual Entry
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Captured on{" "}
              {new Date(lead.createdAt).toLocaleDateString([], {
                month: "long",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>

          {/* Status Changer */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Status:</span>
            <select
              value={lead.status}
              disabled={updating}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="NEW">NEW</option>
              <option value="CONTACTED">CONTACTED</option>
              <option value="QUALIFIED">QUALIFIED</option>
              <option value="WON">WON</option>
              <option value="LOST">LOST</option>
              <option value="ARCHIVED">ARCHIVED</option>
            </select>
            {saveSuccess && (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                Saved
              </span>
            )}
          </div>
        </div>

        {/* Qualification & Notes */}
        <div className="grid grid-cols-1 gap-4 pt-4 border-t border-slate-800/80 text-xs">
          <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800/60 space-y-1.5">
            <span className="text-slate-500 font-medium text-[11px] uppercase tracking-wider block">
              Qualification Details
            </span>
            <p className="text-slate-200 leading-relaxed">
              {lead.qualification || "No qualification details recorded."}
            </p>
          </div>

          {lead.notes && (
            <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800/60 space-y-1.5">
              <span className="text-slate-500 font-medium text-[11px] uppercase tracking-wider block">
                Additional Notes
              </span>
              <p className="text-slate-300 leading-relaxed">{lead.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Caller Profile Card */}
      {lead.contact && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>Caller Contact Profile</span>
            </h2>
            <Link
              href={`/contacts/${lead.contact.id}`}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              View Full Profile →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/60">
              <span className="text-slate-500 text-[11px] block mb-1">Name</span>
              <span className="font-semibold text-white">
                {lead.contact.firstName} {lead.contact.lastName || ""}
              </span>
            </div>

            <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/60">
              <span className="text-slate-500 text-[11px] block mb-1">Phone Number</span>
              <div className="flex items-center gap-1.5 text-slate-200 font-mono">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>{lead.contact.phone || "Not recorded"}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/60">
              <span className="text-slate-500 text-[11px] block mb-1">Email</span>
              <div className="flex items-center gap-1.5 text-slate-200">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>{lead.contact.email || "Not recorded"}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attribution & Session Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-xs text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Bot className="w-4 h-4 text-indigo-400" />
          <span>
            Handled by: <strong className="text-white">{lead.receptionist?.name || "AI Receptionist"}</strong>
          </span>
        </div>

        {lead.testSession && (
          <div className="text-[11px] text-slate-500">
            Recorded in voice test session {lead.testSession.id.slice(0, 8)}
          </div>
        )}
      </div>
    </div>
  );
}
