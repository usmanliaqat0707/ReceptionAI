"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Send,
  Mail,
  MessageSquare,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldAlert,
  RefreshCw,
  User,
  Calendar,
  Layers,
  Webhook,
  RotateCcw,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface CommunicationDetail {
  id: string;
  workspaceId: string;
  channel: "SMS" | "EMAIL";
  purpose: string;
  recipientAddress: string;
  subject?: string | null;
  body: string;
  status: "PENDING" | "QUEUED" | "SENDING" | "SENT" | "DELIVERED" | "FAILED" | "SUPPRESSED" | "CANCELLED";
  idempotencyKey?: string | null;
  estimatedSegments?: number | null;
  createdAt: string;
  queuedAt?: string | null;
  sentAt?: string | null;
  deliveredAt?: string | null;
  failedAt?: string | null;
  metadata?: any;
  recipientContact?: {
    id: string;
    firstName: string;
    lastName?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  deliveryAttempts: Array<{
    id: string;
    attempt: number;
    provider: string;
    providerMessageId?: string | null;
    status: string;
    errorCode?: string | null;
    errorMessageSafe?: string | null;
    createdAt: string;
    completedAt?: string | null;
  }>;
  providerEvents: Array<{
    id: string;
    provider: string;
    providerEventId: string;
    type: string;
    payloadSafe?: any;
    receivedAt: string;
  }>;
}

export default function CommunicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const commId = params.id as string;

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [comm, setComm] = useState<CommunicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ memberships: Array<{ workspace: { id: string; slug: string } }> }>("/api/v1/auth/me")
      .then((data) => {
        if (data.memberships?.length > 0) {
          const storedSlug = localStorage.getItem("rai_active_ws");
          const active =
            data.memberships.find((m) => m.workspace.slug === storedSlug) ||
            data.memberships[0];
          setWorkspaceId(active.workspace.id);
        }
      })
      .catch((err) => console.error("Failed to load workspace:", err));
  }, []);

  const fetchDetail = () => {
    if (!workspaceId || !commId) return;
    setLoading(true);

    apiFetch<{ communication: CommunicationDetail }>(
      `/api/v1/workspaces/${workspaceId}/communications/${commId}`
    )
      .then((res) => setComm(res.communication))
      .catch((err) => console.error("Failed to load communication:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (workspaceId && commId) {
      fetchDetail();
    }
  }, [workspaceId, commId]);

  const handleRetry = async () => {
    if (!workspaceId || !commId) return;
    setRetrying(true);
    setRetryMessage(null);

    try {
      const res = await apiFetch<{ communication: any }>(
        `/api/v1/workspaces/${workspaceId}/communications/${commId}/retry`,
        { method: "POST" }
      );
      setRetryMessage("Manual retry executed successfully.");
      setComm((prev) => (prev ? { ...prev, status: res.communication.status } : null));
      fetchDetail();
    } catch (err: any) {
      setRetryMessage(`Retry failed: ${err.message || "Unknown error"}`);
    } finally {
      setRetrying(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "DELIVERED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/70 text-emerald-400 border border-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5" /> Delivered
          </span>
        );
      case "SENT":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-950/70 text-blue-400 border border-blue-800">
            <Send className="h-3.5 w-3.5" /> Sent to Provider
          </span>
        );
      case "QUEUED":
      case "PENDING":
      case "SENDING":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-950/70 text-amber-400 border border-amber-800">
            <Clock className="h-3.5 w-3.5" /> {status}
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-950/70 text-rose-400 border border-rose-800">
            <AlertTriangle className="h-3.5 w-3.5" /> Delivery Failed
          </span>
        );
      case "SUPPRESSED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-950/70 text-purple-400 border border-purple-800">
            <ShieldAlert className="h-3.5 w-3.5" /> Suppressed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300">
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto text-center text-slate-500 py-24">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-400 mb-3" />
        Loading communication details...
      </div>
    );
  }

  if (!comm) {
    return (
      <div className="p-8 max-w-5xl mx-auto text-center py-24">
        <p className="text-slate-400">Communication record not found.</p>
        <Link href="/communications" className="mt-4 inline-block text-xs text-indigo-400 hover:underline">
          &larr; Back to Communications
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Back button */}
      <div className="mb-6">
        <Link
          href="/communications"
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Communications
        </Link>
      </div>

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl mb-8 shadow-xl">
        <div className="flex items-start gap-4">
          <div
            className={`p-3 rounded-xl border ${
              comm.channel === "SMS"
                ? "bg-sky-950/70 border-sky-800 text-sky-400"
                : "bg-indigo-950/70 border-indigo-800 text-indigo-400"
            }`}
          >
            {comm.channel === "SMS" ? <MessageSquare className="h-6 w-6" /> : <Mail className="h-6 w-6" />}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white tracking-tight">
                {comm.channel} Communication
              </h1>
              {getStatusBadge(comm.status)}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Purpose: <span className="font-semibold text-slate-200">{comm.purpose}</span> &bull; ID:{" "}
              <span className="font-mono text-slate-300">{comm.id}</span>
            </p>
          </div>
        </div>

        {/* Retry Button */}
        {comm.status !== "DELIVERED" && comm.status !== "SUPPRESSED" && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow transition"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} />
              {retrying ? "Retrying..." : "Retry Delivery"}
            </button>
          </div>
        )}
      </div>

      {retryMessage && (
        <div className="mb-6 p-4 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200">
          {retryMessage}
        </div>
      )}

      {/* Metadata Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Recipient Card */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-2">
            <User className="h-4 w-4 text-indigo-400" /> Recipient Details
          </div>
          <p className="text-sm font-mono font-bold text-white mb-1">{comm.recipientAddress}</p>
          {comm.recipientContact ? (
            <Link
              href={`/contacts/${comm.recipientContact.id}`}
              className="text-xs text-indigo-400 hover:underline flex items-center gap-1 mt-1"
            >
              {comm.recipientContact.firstName} {comm.recipientContact.lastName || ""} &rarr;
            </Link>
          ) : (
            <p className="text-xs text-slate-500">Unlinked recipient</p>
          )}
        </div>

        {/* Segments & Specs */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-2">
            <Layers className="h-4 w-4 text-indigo-400" /> Delivery Specifications
          </div>
          <div className="space-y-1 text-xs text-slate-300">
            <p>
              Estimated Segments: <span className="font-semibold text-white">{comm.estimatedSegments || 1}</span>
            </p>
            <p className="truncate">
              Idempotency Key: <span className="font-mono text-[11px] text-slate-400">{comm.idempotencyKey || "none"}</span>
            </p>
          </div>
        </div>

        {/* Delivery Timestamps */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-2">
            <Clock className="h-4 w-4 text-indigo-400" /> Lifecycle Timestamps
          </div>
          <div className="space-y-1 text-[11px] text-slate-300">
            <p>Created: {new Date(comm.createdAt).toLocaleString()}</p>
            {comm.sentAt && <p>Sent: {new Date(comm.sentAt).toLocaleString()}</p>}
            {comm.deliveredAt && (
              <p className="text-emerald-400 font-medium">
                Delivered: {new Date(comm.deliveredAt).toLocaleString()}
              </p>
            )}
            {comm.failedAt && (
              <p className="text-rose-400 font-medium">Failed: {new Date(comm.failedAt).toLocaleString()}</p>
            )}
          </div>
        </div>
      </div>

      {/* Rendered Body Preview */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8 shadow-lg">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
          Message Payload (Server Rendered)
        </h3>
        {comm.subject && (
          <div className="mb-3 pb-3 border-b border-slate-800">
            <span className="text-xs font-semibold text-slate-400">Subject: </span>
            <span className="text-sm font-semibold text-white">{comm.subject}</span>
          </div>
        )}
        <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed">
          {comm.body}
        </div>
      </div>

      {/* Delivery Attempts Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mb-8 shadow-lg">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Send className="h-4 w-4 text-indigo-400" /> Delivery Attempts History
          </h3>
          <span className="text-xs text-slate-400">
            {comm.deliveryAttempts.length} attempt{comm.deliveryAttempts.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/30 text-[11px] font-semibold text-slate-400 uppercase">
                <th className="py-2.5 px-4">Attempt #</th>
                <th className="py-2.5 px-4">Provider</th>
                <th className="py-2.5 px-4">Provider Message ID</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Error / Notes</th>
                <th className="py-2.5 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {comm.deliveryAttempts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    No attempts recorded yet.
                  </td>
                </tr>
              ) : (
                comm.deliveryAttempts.map((att) => (
                  <tr key={att.id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 font-semibold text-white">#{att.attempt}</td>
                    <td className="py-2.5 px-4 font-medium text-slate-300 uppercase">{att.provider}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-300">{att.providerMessageId || "—"}</td>
                    <td className="py-2.5 px-4">{getStatusBadge(att.status)}</td>
                    <td className="py-2.5 px-4 text-rose-400">
                      {att.errorCode ? `${att.errorCode}: ${att.errorMessageSafe}` : "—"}
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 text-[11px]">
                      {new Date(att.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provider Webhook Events Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Webhook className="h-4 w-4 text-indigo-400" /> Provider Webhook Events Log
          </h3>
          <span className="text-xs text-slate-400">
            {comm.providerEvents.length} event{comm.providerEvents.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/30 text-[11px] font-semibold text-slate-400 uppercase">
                <th className="py-2.5 px-4">Provider</th>
                <th className="py-2.5 px-4">Event ID</th>
                <th className="py-2.5 px-4">Event Type</th>
                <th className="py-2.5 px-4">Received At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {comm.providerEvents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-500">
                    No webhook callbacks received yet.
                  </td>
                </tr>
              ) : (
                comm.providerEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 font-semibold text-white uppercase">{evt.provider}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-300">{evt.providerEventId}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-indigo-300 border border-slate-700">
                        {evt.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 text-[11px]">
                      {new Date(evt.receivedAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
