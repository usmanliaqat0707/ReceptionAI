"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Phone,
  Mail,
  Building,
  Calendar,
  Sparkles,
  ExternalLink,
  MessageSquare,
  Target,
  Plus,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Contact {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  normalizedPhone: string | null;
  email: string | null;
  normalizedEmail: string | null;
  company: string | null;
  source: "VOICE_RECEPTIONIST" | "MANUAL" | "IMPORT";
  notes: string | null;
  createdAt: string;
  _count?: {
    leads: number;
    messages: number;
  };
}

export default function ContactsListPage() {
  const [workspace, setWorkspace] = useState<{ id: string; name: string } | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<string>("ALL");

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
          loadContacts(selected.id);
        }
      })
      .catch((err) => console.error("Failed to load user workspace:", err));
  }, []);

  const loadContacts = (workspaceId: string, searchQuery: string = "") => {
    setLoading(true);
    const query = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : "";
    apiFetch<{ data: Contact[] }>(`/api/v1/workspaces/${workspaceId}/contacts${query}`)
      .then((res) => {
        setContacts(res.data || []);
      })
      .catch((err) => console.error("Failed to fetch contacts:", err))
      .finally(() => setLoading(false));
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    if (workspace) {
      loadContacts(workspace.id, val);
    }
  };

  const filteredContacts = contacts.filter((c) => {
    if (sourceFilter !== "ALL" && c.source !== sourceFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-indigo-400" />
            Contacts
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Callers recognized or registered by your AI Receptionist and team members.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3 py-1 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-xs font-medium">
            Total: {contacts.length}
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, phone, email, or company..."
            value={search}
            onChange={handleSearchChange}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {[
            { label: "All Sources", value: "ALL" },
            { label: "Voice Receptionist", value: "VOICE_RECEPTIONIST" },
            { label: "Manual", value: "MANUAL" },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setSourceFilter(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                sourceFilter === tab.value
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contacts List / Table */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center text-slate-500 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
          <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs">Loading contact records...</p>
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className="p-16 flex flex-col items-center justify-center text-center text-slate-500 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
          <Users className="w-12 h-12 text-slate-700 mb-3" />
          <h3 className="text-sm font-semibold text-slate-300">No contacts found</h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1">
            {search
              ? "No contacts match your current search query."
              : "Contacts captured during voice testing sessions or manual registration will appear here."}
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-medium">
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Contact Details</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Activity</th>
                  <th className="py-3 px-4">Captured</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredContacts.map((contact) => (
                  <tr
                    key={contact.id}
                    className="hover:bg-slate-800/30 transition-colors group"
                  >
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/contacts/${contact.id}`}
                        className="font-semibold text-white group-hover:text-indigo-400 transition-colors flex items-center gap-2"
                      >
                        <div className="w-7 h-7 rounded-full bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-bold text-xs">
                          {contact.firstName[0]}
                          {contact.lastName ? contact.lastName[0] : ""}
                        </div>
                        <span>
                          {contact.firstName} {contact.lastName || ""}
                        </span>
                      </Link>
                    </td>

                    <td className="py-3.5 px-4 space-y-1">
                      {contact.phone && (
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Phone className="w-3 h-3 text-slate-500" />
                          <span className="font-mono text-[11px]">{contact.phone}</span>
                        </div>
                      )}
                      {contact.email && (
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Mail className="w-3 h-3 text-slate-500" />
                          <span>{contact.email}</span>
                        </div>
                      )}
                      {!contact.phone && !contact.email && (
                        <span className="text-slate-600 italic">No details</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-400">
                      {contact.company ? (
                        <div className="flex items-center gap-1.5">
                          <Building className="w-3 h-3 text-slate-500" />
                          <span>{contact.company}</span>
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {contact.source === "VOICE_RECEPTIONIST" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          <Sparkles className="w-2.5 h-2.5" />
                          Voice AI
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                          Manual
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3 text-slate-400">
                        <span
                          className="flex items-center gap-1 text-[11px]"
                          title={`${contact._count?.leads || 0} leads`}
                        >
                          <Target className="w-3 h-3 text-indigo-400" />
                          {contact._count?.leads || 0}
                        </span>
                        <span
                          className="flex items-center gap-1 text-[11px]"
                          title={`${contact._count?.messages || 0} messages`}
                        >
                          <MessageSquare className="w-3 h-3 text-teal-400" />
                          {contact._count?.messages || 0}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      {new Date(contact.createdAt).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/contacts/${contact.id}`}
                        className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
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
