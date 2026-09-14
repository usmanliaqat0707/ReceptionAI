"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Send,
  Mail,
  MessageSquare,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldAlert,
  ChevronRight,
  ExternalLink,
  Plus,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface OutboundCommunicationItem {
  id: string;
  channel: "SMS" | "EMAIL";
  purpose: string;
  recipientAddress: string;
  subject?: string | null;
  body: string;
  status: "PENDING" | "QUEUED" | "SENDING" | "SENT" | "DELIVERED" | "FAILED" | "SUPPRESSED" | "CANCELLED";
  createdAt: string;
  sentAt?: string | null;
  deliveredAt?: string | null;
  failedAt?: string | null;
  recipientContact?: {
    id: string;
    firstName: string;
    lastName?: string | null;
  } | null;
  deliveryAttempts?: Array<{
    attempt: number;
    status: string;
    errorCode?: string | null;
  }>;
}

function CommunicationsContent() {
  const searchParams = useSearchParams();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [communications, setCommunications] = useState<OutboundCommunicationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showTestModal, setShowTestModal] = useState(false);
  const [testChannel, setTestChannel] = useState<"SMS" | "EMAIL">("SMS");
  const [testRecipient, setTestRecipient] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

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

  const fetchCommunications = () => {
    if (!workspaceId) return;
    setLoading(true);

    const query = new URLSearchParams();
    if (channelFilter !== "ALL") query.set("channel", channelFilter);
    if (statusFilter !== "ALL") query.set("status", statusFilter);
    if (searchQuery.trim()) query.set("search", searchQuery.trim());
    query.set("limit", "50");

    apiFetch<{ total: number; items: OutboundCommunicationItem[] }>(
      `/api/v1/workspaces/${workspaceId}/communications?${query.toString()}`
    )
      .then((res) => {
        setCommunications(res.items);
        setTotal(res.total);
      })
      .catch((err) => console.error("Error fetching communications:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (workspaceId) {
      fetchCommunications();
    }
  }, [workspaceId, channelFilter, statusFilter]);

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !testRecipient) return;

    setSendingTest(true);
    setTestResult(null);

    try {
      const res = await apiFetch<{ communication: any }>(
        `/api/v1/workspaces/${workspaceId}/communications/send-test`,
        {
          method: "POST",
          body: JSON.stringify({
            channel: testChannel,
            recipient: testRecipient,
            message: testMessage || undefined,
          }),
        }
      );

      setTestResult(`Success! Test message ${res.communication.status}.`);
      fetchCommunications();
      setTimeout(() => {
        setShowTestModal(false);
        setTestResult(null);
        setTestRecipient("");
        setTestMessage("");
      }, 1500);
    } catch (err: any) {
      setTestResult(`Error: ${err.message || "Failed to send test message"}`);
    } finally {
      setSendingTest(false);
    }
  };

  const formatPurpose = (purpose: string) => {
    return purpose
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const getStatusBadge = (status: OutboundCommunicationItem["status"]) => {
    switch (status) {
      case "DELIVERED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
            <CheckCircle2 className="h-3 w-3" /> Delivered
          </span>
        );
      case "SENT":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-950/60 text-blue-400 border border-blue-800/60">
            <Send className="h-3 w-3" /> Sent
          </span>
        );
      case "QUEUED":
      case "PENDING":
      case "SENDING":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-950/60 text-amber-400 border border-amber-800/60">
            <Clock className="h-3 w-3" /> {status}
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-950/60 text-rose-400 border border-rose-800/60">
            <AlertTriangle className="h-3 w-3" /> Failed
          </span>
        );
      case "SUPPRESSED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-950/60 text-purple-400 border border-purple-800/60">
            <ShieldAlert className="h-3 w-3" /> Suppressed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            <Send className="h-6 w-6 text-indigo-400" />
            Outbound Communications
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Policy-controlled SMS and email delivery log with verifiable provider confirmation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTestModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow transition"
          >
            <Plus className="h-4 w-4" /> Send Test Message
          </button>
          <Link
            href="/settings/communications"
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition"
          >
            Policy & Settings
          </Link>
          <button
            onClick={fetchCommunications}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-indigo-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-900/70 border border-slate-800 p-3.5 rounded-xl mb-6 backdrop-blur">
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Channel Filter */}
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
            {(["ALL", "SMS", "EMAIL"] as const).map((ch) => (
              <button
                key={ch}
                onClick={() => setChannelFilter(ch)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition ${
                  channelFilter === ch
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {ch === "ALL" ? "All Channels" : ch}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="DELIVERED">Delivered</option>
            <option value="SENT">Sent</option>
            <option value="QUEUED">Queued / Pending</option>
            <option value="FAILED">Failed</option>
            <option value="SUPPRESSED">Suppressed</option>
          </select>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search recipient or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchCommunications()}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Communications Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Channel</th>
                <th className="py-3 px-4">Recipient</th>
                <th className="py-3 px-4">Purpose</th>
                <th className="py-3 px-4">Content Preview</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-400 mb-2" />
                    Loading communications...
                  </td>
                </tr>
              ) : communications.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No outbound communications found matching your filters.
                  </td>
                </tr>
              ) : (
                communications.map((comm) => (
                  <tr key={comm.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {comm.channel === "SMS" ? (
                          <span className="p-1.5 rounded-lg bg-sky-950/60 text-sky-400 border border-sky-800/50">
                            <MessageSquare className="h-3.5 w-3.5" />
                          </span>
                        ) : (
                          <span className="p-1.5 rounded-lg bg-indigo-950/60 text-indigo-400 border border-indigo-800/50">
                            <Mail className="h-3.5 w-3.5" />
                          </span>
                        )}
                        <span className="font-semibold text-white">{comm.channel}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <span className="font-mono text-slate-200">{comm.recipientAddress}</span>
                        {comm.recipientContact && (
                          <p className="text-[11px] text-slate-400">
                            {comm.recipientContact.firstName} {comm.recipientContact.lastName || ""}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        {formatPurpose(comm.purpose)}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      {comm.subject && (
                        <p className="font-medium text-slate-200 truncate mb-0.5">{comm.subject}</p>
                      )}
                      <p className="text-slate-400 truncate">{comm.body}</p>
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(comm.status)}</td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {new Date(comm.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/communications/${comm.id}`}
                        className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium text-xs transition"
                      >
                        Inspect <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Test Message Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
              <Send className="h-5 w-5 text-indigo-400" /> Send Test Notification
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Sends an authenticated operational connectivity test via the active provider.
            </p>

            {testResult && (
              <div
                className={`p-3 rounded-lg text-xs mb-4 border ${
                  testResult.startsWith("Success")
                    ? "bg-emerald-950/60 text-emerald-400 border-emerald-800"
                    : "bg-rose-950/60 text-rose-400 border-rose-800"
                }`}
              >
                {testResult}
              </div>
            )}

            <form onSubmit={handleSendTest} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Channel</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTestChannel("SMS")}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border flex items-center justify-center gap-2 transition ${
                      testChannel === "SMS"
                        ? "bg-indigo-600 border-indigo-500 text-white"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    <MessageSquare className="h-4 w-4" /> SMS
                  </button>
                  <button
                    type="button"
                    onClick={() => setTestChannel("EMAIL")}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border flex items-center justify-center gap-2 transition ${
                      testChannel === "EMAIL"
                        ? "bg-indigo-600 border-indigo-500 text-white"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    <Mail className="h-4 w-4" /> Email
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {testChannel === "SMS" ? "Recipient Phone Number (E.164)" : "Recipient Email Address"}
                </label>
                <input
                  type={testChannel === "SMS" ? "tel" : "email"}
                  required
                  placeholder={testChannel === "SMS" ? "+15555550100" : "test@example.com"}
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Custom Message Body (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Leave blank for standard automated ping."
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTestModal(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingTest}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition"
                >
                  {sendingTest ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" /> Dispatch Test
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CommunicationsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-slate-500">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-400 mb-2" />
          Loading communications dashboard...
        </div>
      }
    >
      <CommunicationsContent />
    </Suspense>
  );
}
