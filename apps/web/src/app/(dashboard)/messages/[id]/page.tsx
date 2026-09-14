"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  MessageSquare,
  Users,
  Phone,
  Mail,
  Building,
  Clock,
  CheckCircle2,
  PhoneForwarded,
  AlertCircle,
  Bot,
  Check,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function MessageDetailPage() {
  const params = useParams<{ id: string }>();
  const messageId = params.id;
  const [workspace, setWorkspace] = useState<{ id: string; name: string } | null>(null);
  const [message, setMessage] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [statusSuccess, setStatusSuccess] = useState(false);

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
          loadMessage(selected.id);
        }
      })
      .catch((err) => console.error("Failed to load user workspace:", err));
  }, [messageId]);

  const loadMessage = (workspaceId: string) => {
    setLoading(true);
    apiFetch<{ data: any }>(`/api/v1/workspaces/${workspaceId}/messages/${messageId}`)
      .then((res) => {
        setMessage(res.data);
      })
      .catch((err) => console.error("Failed to fetch message details:", err))
      .finally(() => setLoading(false));
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!workspace) return;
    setUpdating(true);
    try {
      await apiFetch(
        `/api/v1/workspaces/${workspace.id}/messages/${messageId}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: newStatus }),
        }
      );
      setMessage((prev: any) => ({ ...prev, status: newStatus }));
      setStatusSuccess(true);
      setTimeout(() => setStatusSuccess(false), 2500);
    } catch (err) {
      console.error("Failed to update message status:", err);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 flex flex-col items-center justify-center text-slate-500 max-w-4xl mx-auto">
        <div className="w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs">Loading message...</p>
      </div>
    );
  }

  if (!message) {
    return (
      <div className="p-16 flex flex-col items-center justify-center text-center text-slate-500 max-w-4xl mx-auto">
        <MessageSquare className="w-12 h-12 text-slate-700 mb-3" />
        <h3 className="text-sm font-semibold text-slate-300">Message not found</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
          This message record could not be found in the current workspace.
        </p>
        <Link
          href="/messages"
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium"
        >
          Back to Messages
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back button */}
      <div>
        <Link
          href="/messages"
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Messages</span>
        </Link>
      </div>

      {/* Main Message Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-white">{message.subject}</h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium uppercase ${
                  message.urgency === "URGENT" || message.urgency === "HIGH"
                    ? "bg-rose-500/15 text-rose-400 border border-rose-500/20"
                    : "bg-slate-800 text-slate-400 border border-slate-700"
                }`}
              >
                {message.urgency}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Received on{" "}
              {new Date(message.createdAt).toLocaleDateString([], {
                month: "long",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>

          {/* Quick Status Buttons */}
          <div className="flex items-center gap-2">
            {["READ", "IN_PROGRESS", "RESOLVED"].map((status) => (
              <button
                key={status}
                type="button"
                disabled={updating || message.status === status}
                onClick={() => handleUpdateStatus(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  message.status === status
                    ? "bg-teal-600 text-white font-semibold shadow-sm"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                }`}
              >
                {status.replace("_", " ")}
              </button>
            ))}
            {statusSuccess && (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                Updated
              </span>
            )}
          </div>
        </div>

        {/* Callback Banner if requested */}
        {message.callbackRequested && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-xl flex items-center gap-3 text-xs text-amber-200">
            <PhoneForwarded className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <span className="font-semibold block text-amber-300">
                Return Callback Requested
              </span>
              <span>
                Preferred window:{" "}
                <strong className="text-white">{message.requestedCallbackWindow}</strong>
                {message.requestedCallbackAt && (
                  <>
                    {" "}
                    (Specific target time:{" "}
                    {new Date(message.requestedCallbackAt).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    )
                  </>
                )}
              </span>
            </div>
          </div>
        )}

        {/* Full Message Body */}
        <div className="p-5 bg-slate-950/50 rounded-xl border border-slate-800/80 space-y-2 text-xs">
          <span className="text-slate-500 font-medium text-[11px] uppercase tracking-wider block">
            Message Transcript & Details
          </span>
          <p className="text-slate-200 leading-relaxed text-sm whitespace-pre-wrap">
            {message.body}
          </p>
        </div>
      </div>

      {/* Caller Contact Profile Card */}
      {message.contact && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-400" />
              <span>Caller Contact Info</span>
            </h2>
            <Link
              href={`/contacts/${message.contact.id}`}
              className="text-xs text-teal-400 hover:text-teal-300 font-medium"
            >
              View Full Profile →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/60">
              <span className="text-slate-500 text-[11px] block mb-1">Name</span>
              <span className="font-semibold text-white">
                {message.contact.firstName} {message.contact.lastName || ""}
              </span>
            </div>

            <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/60">
              <span className="text-slate-500 text-[11px] block mb-1">Phone Number</span>
              <div className="flex items-center gap-1.5 text-slate-200 font-mono">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>{message.contact.phone || "Not recorded"}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/60">
              <span className="text-slate-500 text-[11px] block mb-1">Email</span>
              <div className="flex items-center gap-1.5 text-slate-200">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>{message.contact.email || "Not recorded"}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer Attribution */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-xs text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Bot className="w-4 h-4 text-teal-400" />
          <span>
            Taken by: <strong className="text-white">{message.receptionist?.name || "AI Receptionist"}</strong>
          </span>
        </div>

        {message.testSession && (
          <div className="text-[11px] text-slate-500">
            Recorded in voice test session {message.testSession.id.slice(0, 8)}
          </div>
        )}
      </div>
    </div>
  );
}
