"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bot,
  Plus,
  Search,
  MoreVertical,
  Edit2,
  Copy,
  PlayCircle,
  CheckCircle2,
  PauseCircle,
  Archive,
  AlertCircle,
  Check,
  Radio,
  Mic,
} from "lucide-react";
import { Button, Badge, Card, cn } from "@receptionai/ui";
import { apiFetch, ApiException } from "@/lib/api";

interface ReceptionistItem {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  roleTitle: string;
  industry: string;
  primaryLanguage: string;
  status: "DRAFT" | "TESTING" | "ACTIVE" | "PAUSED" | "ARCHIVED";
  readinessScore: number;
  isComplete: boolean;
  runtimeReadiness: string;
  configurationVersion: number;
  greeting?: string | null;
  updatedAt: string;
}

interface Workspace {
  id: string;
  name: string;
  slug: string;
}

export default function ReceptionistsListPage() {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [receptionists, setReceptionists] = useState<ReceptionistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Dialog state
  const [confirmAction, setConfirmAction] = useState<{
    type: "activate" | "pause" | "archive" | "testing" | "duplicate";
    receptionist: ReceptionistItem;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      // Fetch user workspaces
      const wsData = await apiFetch<Workspace[]>("/api/v1/workspaces");
      if (!wsData || wsData.length === 0) {
        setLoading(false);
        return;
      }
      const storedSlug = typeof window !== "undefined" ? localStorage.getItem("rai_active_ws") : null;
      const activeWs = wsData.find((w) => w.slug === storedSlug) || wsData[0];
      setWorkspace(activeWs);

      // Fetch receptionists for workspace
      const queryParam = statusFilter === "ALL" ? "" : `?status=${statusFilter}`;
      const recData = await apiFetch<ReceptionistItem[]>(
        `/api/v1/workspaces/${activeWs.id}/receptionists${queryParam}`
      );
      setReceptionists(recData);
    } catch (err: any) {
      setError(err.message || "Failed to load receptionists.");
    } finally {
      setLoading(false);
    }
  }

  const filteredReceptionists = receptionists.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.roleTitle.toLowerCase().includes(q) ||
      r.industry.toLowerCase().includes(q)
    );
  });

  async function handleExecuteAction() {
    if (!confirmAction || !workspace) return;
    setActionLoading(true);
    setActionError(null);

    const { type, receptionist } = confirmAction;

    try {
      if (type === "duplicate") {
        const res = await apiFetch<ReceptionistItem>(
          `/api/v1/workspaces/${workspace.id}/receptionists/${receptionist.id}/duplicate`,
          { method: "POST" }
        );
        setConfirmAction(null);
        router.push(`/receptionists/${res.id}`);
        return;
      }

      await apiFetch(
        `/api/v1/workspaces/${workspace.id}/receptionists/${receptionist.id}/${type}`,
        { method: "POST" }
      );

      setConfirmAction(null);
      loadData();
    } catch (err: any) {
      setActionError(err.message || "Action failed.");
    } finally {
      setActionLoading(false);
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "ACTIVE":
        return <Badge variant="success">Active</Badge>;
      case "TESTING":
        return <Badge variant="purple">Testing</Badge>;
      case "PAUSED":
        return <Badge variant="warning">Paused</Badge>;
      case "ARCHIVED":
        return <Badge variant="default">Archived</Badge>;
      case "DRAFT":
      default:
        return <Badge variant="default">Draft</Badge>;
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-white tracking-tight">AI Receptionists</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure virtual receptionist identities, voice parameters, greetings, and conversation
            behavior.
          </p>
        </div>

        <Link href="/receptionists/new">
          <Button size="sm" className="w-full sm:w-auto">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Create Receptionist
          </Button>
        </Link>
      </div>

      {/* Runtime Notice Alert */}
      <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 p-3 flex items-start gap-3">
        <Radio className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-300 leading-relaxed">
          <span className="font-semibold text-white">Phase 2 Configuration Mode:</span> AI
          Receptionists configured here store validated conversation models and business rules.
          Realtime telephony and voice runtime will be connected in Phase 3.
        </div>
      </div>

      {/* Search & Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-lg w-fit overflow-x-auto">
          {["ALL", "DRAFT", "TESTING", "ACTIVE", "PAUSED", "ARCHIVED"].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={cn(
                "px-2.5 py-1 text-[11px] font-medium rounded-md transition",
                statusFilter === tab
                  ? "bg-slate-800 text-white shadow-xs font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              {tab === "ALL" ? "All Statuses" : tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <Card className="divide-y divide-slate-800 p-0 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-slate-800" />
                <div className="space-y-1.5">
                  <div className="h-3.5 w-32 bg-slate-800 rounded" />
                  <div className="h-2.5 w-48 bg-slate-800 rounded" />
                </div>
              </div>
              <div className="h-5 w-16 bg-slate-800 rounded" />
            </div>
          ))}
        </Card>
      )}

      {/* Empty State */}
      {!loading && filteredReceptionists.length === 0 && (
        <Card className="p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 mb-3">
            <Bot className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-white">No AI Receptionists Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-5">
            {searchQuery || statusFilter !== "ALL"
              ? "No receptionists matched your filter criteria. Try clearing the filter or search query."
              : "Create your first virtual receptionist to define how your business answers calls and handles inquiries."}
          </p>
          <Link href="/receptionists/new">
            <Button size="sm">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Create Receptionist
            </Button>
          </Link>
        </Card>
      )}

      {/* Receptionists Directory Table */}
      {!loading && filteredReceptionists.length > 0 && (
        <Card className="p-0 overflow-hidden border border-slate-800 divide-y divide-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 text-slate-400 text-[11px] font-semibold uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Receptionist</th>
                  <th className="py-3 px-4">Role Title</th>
                  <th className="py-3 px-4">Configuration</th>
                  <th className="py-3 px-4">Runtime Readiness</th>
                  <th className="py-3 px-4">Language</th>
                  <th className="py-3 px-4">Version</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {filteredReceptionists.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-800/30 transition">
                    {/* Name & Avatar */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold shrink-0">
                          {rec.name.charAt(0)}
                        </div>
                        <div>
                          <Link
                            href={`/receptionists/${rec.id}`}
                            className="font-semibold text-white hover:text-indigo-400 transition"
                          >
                            {rec.name}
                          </Link>
                          <p className="text-[11px] text-slate-500 font-mono">/{rec.slug}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role Title */}
                    <td className="py-3.5 px-4 font-medium text-slate-300">{rec.roleTitle}</td>

                    {/* Status & Readiness Score */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(rec.status)}
                        <span className="text-[11px] text-slate-500 font-mono">
                          {rec.readinessScore}%
                        </span>
                      </div>
                    </td>

                    {/* Runtime Readiness */}
                    <td className="py-3.5 px-4">
                      {rec.status !== "DRAFT" ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                          Browser Test Ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                          Draft Incomplete
                        </span>
                      )}
                    </td>

                    {/* Language */}
                    <td className="py-3.5 px-4 text-slate-400 font-mono">{rec.primaryLanguage}</td>

                    {/* Version */}
                    <td className="py-3.5 px-4 text-slate-400 font-mono">
                      v{rec.configurationVersion}
                    </td>

                    {/* Actions Menu */}
                    <td className="py-3.5 px-4 text-right relative">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/receptionists/${rec.id}/test`}>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 text-[11px] text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/10 bg-indigo-500/5 font-medium"
                          >
                            <Mic className="h-3 w-3 mr-1 text-indigo-400" />
                            Test Voice
                          </Button>
                        </Link>

                        <Link href={`/receptionists/${rec.id}`}>
                          <Button size="sm" variant="secondary" className="h-7 text-[11px]">
                            <Edit2 className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                        </Link>

                        <div className="relative">
                          <button
                            onClick={() => setActiveMenuId(activeMenuId === rec.id ? null : rec.id)}
                            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>

                          {activeMenuId === rec.id && (
                            <div className="absolute right-0 mt-1 w-44 rounded-lg bg-slate-900 border border-slate-800 shadow-xl z-30 py-1 text-left">
                              <button
                                onClick={() => {
                                  setActiveMenuId(null);
                                  setConfirmAction({ type: "duplicate", receptionist: rec });
                                }}
                                className="w-full px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 flex items-center gap-2"
                              >
                                <Copy className="h-3.5 w-3.5 text-slate-400" />
                                Duplicate
                              </button>

                              {rec.status === "DRAFT" && (
                                <button
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    setConfirmAction({ type: "testing", receptionist: rec });
                                  }}
                                  className="w-full px-3 py-1.5 text-xs text-purple-400 hover:bg-slate-800 flex items-center gap-2"
                                >
                                  <PlayCircle className="h-3.5 w-3.5" />
                                  Set to Testing
                                </button>
                              )}

                              {(rec.status === "DRAFT" ||
                                rec.status === "TESTING" ||
                                rec.status === "PAUSED") && (
                                <button
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    setConfirmAction({ type: "activate", receptionist: rec });
                                  }}
                                  className="w-full px-3 py-1.5 text-xs text-emerald-400 hover:bg-slate-800 flex items-center gap-2"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Activate
                                </button>
                              )}

                              {rec.status === "ACTIVE" && (
                                <button
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    setConfirmAction({ type: "pause", receptionist: rec });
                                  }}
                                  className="w-full px-3 py-1.5 text-xs text-amber-400 hover:bg-slate-800 flex items-center gap-2"
                                >
                                  <PauseCircle className="h-3.5 w-3.5" />
                                  Pause
                                </button>
                              )}

                              {rec.status !== "ARCHIVED" && (
                                <button
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    setConfirmAction({ type: "archive", receptionist: rec });
                                  }}
                                  className="w-full px-3 py-1.5 text-xs text-rose-400 hover:bg-slate-800 flex items-center gap-2 border-t border-slate-800 mt-1"
                                >
                                  <Archive className="h-3.5 w-3.5" />
                                  Archive
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white capitalize">
              {confirmAction.type} Receptionist
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed">
              {confirmAction.type === "activate" && (
                <>
                  Are you sure you want to mark <strong>{confirmAction.receptionist.name}</strong>{" "}
                  as <strong>Active</strong>? An immutable configuration snapshot will be created.
                  Note that live voice call handling remains unavailable in Phase 2.
                </>
              )}
              {confirmAction.type === "testing" && (
                <>
                  Are you sure you want to transition{" "}
                  <strong>{confirmAction.receptionist.name}</strong> to <strong>Testing</strong>? An
                  immutable configuration snapshot will be saved.
                </>
              )}
              {confirmAction.type === "pause" && (
                <>
                  Pausing <strong>{confirmAction.receptionist.name}</strong> will disable this
                  configuration from production call routing once telephony is connected in Phase 3.
                </>
              )}
              {confirmAction.type === "archive" && (
                <>
                  Archiving <strong>{confirmAction.receptionist.name}</strong> will retain its
                  configuration history for audit purposes while removing it from active lists.
                </>
              )}
              {confirmAction.type === "duplicate" && (
                <>
                  Duplicate <strong>{confirmAction.receptionist.name}</strong> into a new{" "}
                  <strong>DRAFT</strong> receptionist with copied configuration.
                </>
              )}
            </p>

            {actionError && (
              <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2.5 text-xs text-rose-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfirmAction(null)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant={confirmAction.type === "archive" ? "danger" : "primary"}
                onClick={handleExecuteAction}
                isLoading={actionLoading}
              >
                Confirm {confirmAction.type.charAt(0).toUpperCase() + confirmAction.type.slice(1)}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
