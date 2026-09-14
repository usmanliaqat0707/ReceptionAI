"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Search,
  Phone,
  Clock,
  AlertCircle,
  ExternalLink,
  Bot,
  CheckCircle2,
  Calendar,
  PhoneForwarded,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Message {
  id: string;
  subject: string;
  body: string;
  urgency: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  status: "NEW" | "READ" | "IN_PROGRESS" | "RESOLVED" | "ARCHIVED";
  callbackRequested: boolean;
  requestedCallbackAt: string | null;
  requestedCallbackWindow: "MORNING" | "AFTERNOON" | "EVENING" | "ANYTIME";
  createdAt: string;
  contact: {
    id: string;
    firstName: string;
    lastName: string | null;
    phone: string | null;
    email: string | null;
  };
  receptionist?: {
    id: string;
    name: string;
  } | null;
}

export default function MessagesListPage() {
  const [workspace, setWorkspace] = useState<{ id: string; name: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");

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
          loadMessages(selected.id);
        }
      })
      .catch((err) => console.error("Failed to load user workspace:", err));
  }, []);

  const loadMessages = (workspaceId: string, filterType: string = "ALL") => {
    setLoading(true);
    let query = "";
    if (filterType === "CALLBACKS") query = "?callbackRequested=true";
    else if (filterType === "URGENT") query = "?urgency=HIGH";
    else if (filterType === "NEW") query = "?status=NEW";

    apiFetch<{ data: Message[] }>(`/api/v1/workspaces/${workspaceId}/messages${query}`)
      .then((res) => {
        setMessages(res.data || []);
      })
      .catch((err) => console.error("Failed to fetch messages:", err))
      .finally(() => setLoading(false));
  };

  const handleFilterChange = (filterType: string) => {
    setFilter(filterType);
    if (workspace) {
      loadMessages(workspace.id, filterType);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <MessageSquare className="w-6 h-6 text-teal-400" />
            Messages & Callbacks
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Structured messages and return callback requests taken by your AI Receptionist.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-xs font-medium">
            Total: {messages.length}
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto bg-slate-900/60 border border-slate-800/80 p-2 rounded-xl">
        {[
          { label: "All Messages", value: "ALL" },
          { label: "New & Unread", value: "NEW" },
          { label: "Callbacks Requested", value: "CALLBACKS" },
          { label: "Urgent", value: "URGENT" },
        ].map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => handleFilterChange(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              filter === tab.value
                ? "bg-teal-600 text-white shadow-sm"
                : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Messages Table */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center text-slate-500 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
          <div className="w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs">Loading message inbox...</p>
        </div>
      ) : messages.length === 0 ? (
        <div className="p-16 flex flex-col items-center justify-center text-center text-slate-500 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
          <MessageSquare className="w-12 h-12 text-slate-700 mb-3" />
          <h3 className="text-sm font-semibold text-slate-300">No messages found</h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1">
            When callers leave messages or request callbacks with your AI Receptionist, they will appear here.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-medium">
                  <th className="py-3 px-4">Caller</th>
                  <th className="py-3 px-4">Subject & Message</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Urgency</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Captured</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {messages.map((msg) => (
                  <tr
                    key={msg.id}
                    className="hover:bg-slate-800/30 transition-colors group"
                  >
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/contacts/${msg.contact.id}`}
                        className="font-semibold text-white group-hover:text-teal-400 transition-colors block"
                      >
                        {msg.contact.firstName} {msg.contact.lastName || ""}
                      </Link>
                      {msg.contact.phone && (
                        <span className="text-[11px] text-slate-400 font-mono">
                          {msg.contact.phone}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 max-w-md">
                      <span className="font-medium text-slate-200 block truncate">
                        {msg.subject}
                      </span>
                      <p className="text-slate-400 text-[11px] truncate mt-0.5">
                        {msg.body}
                      </p>
                    </td>

                    <td className="py-3.5 px-4">
                      {msg.callbackRequested ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          <PhoneForwarded className="w-2.5 h-2.5" />
                          Callback ({msg.requestedCallbackWindow})
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                          General Message
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase ${
                          msg.urgency === "URGENT"
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold"
                            : msg.urgency === "HIGH"
                              ? "bg-amber-500/15 text-amber-300 border border-amber-500/20"
                              : "bg-slate-800 text-slate-400 border border-slate-700"
                        }`}
                      >
                        {msg.urgency}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase ${
                          msg.status === "NEW"
                            ? "bg-teal-500/15 text-teal-300 border border-teal-500/20"
                            : msg.status === "RESOLVED"
                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
                              : "bg-slate-800 text-slate-400 border border-slate-700"
                        }`}
                      >
                        {msg.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      {new Date(msg.createdAt).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/messages/${msg.id}`}
                        className="inline-flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 font-medium transition-colors"
                      >
                        <span>View</span>
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
