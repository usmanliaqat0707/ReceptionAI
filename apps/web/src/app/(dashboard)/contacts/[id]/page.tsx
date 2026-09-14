"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Users,
  Phone,
  Mail,
  Building,
  Calendar,
  Sparkles,
  Target,
  MessageSquare,
  Clock,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function ContactDetailPage() {
  const params = useParams<{ id: string }>();
  const contactId = params.id;
  const [workspace, setWorkspace] = useState<{ id: string; name: string } | null>(null);
  const [contact, setContact] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

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
          loadContact(selected.id);
        }
      })
      .catch((err) => console.error("Failed to load user workspace:", err));
  }, [contactId]);

  const loadContact = (workspaceId: string) => {
    setLoading(true);
    apiFetch<{ data: any }>(`/api/v1/workspaces/${workspaceId}/contacts/${contactId}`)
      .then((res) => {
        setContact(res.data);
      })
      .catch((err) => console.error("Failed to fetch contact details:", err))
      .finally(() => setLoading(false));
  };

  if (loading) {
    return (
      <div className="p-16 flex flex-col items-center justify-center text-slate-500 max-w-5xl mx-auto">
        <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs">Loading caller profile...</p>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="p-16 flex flex-col items-center justify-center text-center text-slate-500 max-w-5xl mx-auto">
        <Users className="w-12 h-12 text-slate-700 mb-3" />
        <h3 className="text-sm font-semibold text-slate-300">Contact not found</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
          This contact record could not be located in the current workspace.
        </p>
        <Link
          href="/contacts"
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium"
        >
          Back to Contacts
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back button */}
      <div>
        <Link
          href="/contacts"
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Contacts</span>
        </Link>
      </div>

      {/* Profile Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-bold text-xl flex-shrink-0">
              {contact.firstName[0]}
              {contact.lastName ? contact.lastName[0] : ""}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-white">
                  {contact.firstName} {contact.lastName || ""}
                </h1>
                {contact.source === "VOICE_RECEPTIONIST" ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <Sparkles className="w-3 h-3" />
                    Voice AI Registered
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                    Manual Contact
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                <span>First recorded:</span>
                <span>
                  {new Date(contact.createdAt).toLocaleDateString([], {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-800/80 text-xs">
          <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/60">
            <span className="text-slate-500 text-[11px] block mb-1">Phone Number</span>
            <div className="flex items-center gap-1.5 text-slate-200 font-mono">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              <span>{contact.phone || "Not recorded"}</span>
            </div>
          </div>

          <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/60">
            <span className="text-slate-500 text-[11px] block mb-1">Email Address</span>
            <div className="flex items-center gap-1.5 text-slate-200">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span>{contact.email || "Not recorded"}</span>
            </div>
          </div>

          <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/60">
            <span className="text-slate-500 text-[11px] block mb-1">Company</span>
            <div className="flex items-center gap-1.5 text-slate-200">
              <Building className="w-3.5 h-3.5 text-slate-400" />
              <span>{contact.company || "Not specified"}</span>
            </div>
          </div>
        </div>

        {contact.notes && (
          <div className="mt-4 p-3.5 bg-slate-950/50 rounded-xl border border-slate-800/80 text-xs text-slate-300">
            <span className="text-slate-500 font-medium text-[11px] uppercase tracking-wider block mb-1">
              Caller Notes
            </span>
            <p className="leading-relaxed">{contact.notes}</p>
          </div>
        )}
      </div>

      {/* Linked Leads Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Target className="w-4 h-4 text-indigo-400" />
          <span>Inquiries & Leads ({contact.leads?.length || 0})</span>
        </h2>

        {!contact.leads || contact.leads.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-3">
            No sales inquiries or leads recorded for this contact yet.
          </p>
        ) : (
          <div className="space-y-2.5">
            {contact.leads.map((lead: any) => (
              <div
                key={lead.id}
                className="p-4 bg-slate-950/40 border border-slate-800/80 rounded-xl flex items-start justify-between gap-4 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{lead.intent}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      {lead.status}
                    </span>
                  </div>
                  {lead.qualification && (
                    <p className="text-slate-400 text-xs leading-relaxed">
                      {lead.qualification}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-500">
                    Captured by {lead.receptionist?.name || "AI"} •{" "}
                    {new Date(lead.createdAt).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>

                <Link
                  href={`/leads/${lead.id}`}
                  className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium flex-shrink-0"
                >
                  <span>View</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Linked Messages Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-teal-400" />
          <span>Messages & Callback Requests ({contact.messages?.length || 0})</span>
        </h2>

        {!contact.messages || contact.messages.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-3">
            No messages or callbacks requested by this contact yet.
          </p>
        ) : (
          <div className="space-y-2.5">
            {contact.messages.map((msg: any) => (
              <div
                key={msg.id}
                className="p-4 bg-slate-950/40 border border-slate-800/80 rounded-xl flex items-start justify-between gap-4 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{msg.subject}</span>
                    {msg.callbackRequested && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Callback: {msg.requestedCallbackWindow || "ANYTIME"}
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        msg.urgency === "URGENT" || msg.urgency === "HIGH"
                          ? "bg-rose-500/15 text-rose-400 border border-rose-500/20"
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                      }`}
                    >
                      {msg.urgency}
                    </span>
                  </div>
                  <p className="text-slate-300 text-xs leading-relaxed">{msg.body}</p>
                  <p className="text-[11px] text-slate-500">
                    Taken by {msg.receptionist?.name || "AI"} •{" "}
                    {new Date(msg.createdAt).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>

                <Link
                  href={`/messages/${msg.id}`}
                  className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium flex-shrink-0"
                >
                  <span>View</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
