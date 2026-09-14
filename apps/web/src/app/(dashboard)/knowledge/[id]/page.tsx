"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Globe,
  FileText,
  HelpCircle,
  RotateCw,
  Archive,
  CheckCircle2,
  AlertCircle,
  Bot,
  ExternalLink,
  Layers,
  Clock,
  Check,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { ThemedDialog } from "@/components/ThemedDialog";

export default function KnowledgeSourceDetailPage() {
  const params = useParams<{ id: string }>();
  const sourceId = params.id;
  const [workspace, setWorkspace] = useState<{ id: string; name: string } | null>(null);
  const [source, setSource] = useState<any | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reindexing, setReindexing] = useState(false);
  const [reindexSuccess, setReindexSuccess] = useState(false);

  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    type?: "confirm" | "alert" | "error" | "success";
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    confirmVariant?: "danger" | "primary";
    onConfirm: () => void;
    onCancel?: () => void;
  } | null>(null);

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
          loadSourceDetails(selected.id);
        }
      })
      .catch((err) => console.error("Failed to load user workspace:", err));
  }, [sourceId]);

  const loadSourceDetails = (workspaceId: string, silent = false) => {
    if (!silent) setLoading(true);
    Promise.all([
      apiFetch<any>(`/api/v1/workspaces/${workspaceId}/knowledge/sources/${sourceId}`),
      apiFetch<any>(`/api/v1/workspaces/${workspaceId}/knowledge/sources/${sourceId}/documents`),
    ])
      .then(([sourceRes, docsRes]) => {
        const src = sourceRes?.data !== undefined ? sourceRes.data : sourceRes;
        const docs = Array.isArray(docsRes) ? docsRes : docsRes?.data || [];
        setSource(src);
        setDocuments(docs);
      })
      .catch((err) => console.error("Failed to fetch source details:", err))
      .finally(() => {
        if (!silent) setLoading(false);
      });
  };

  // Poll automatically if source is currently indexing
  useEffect(() => {
    if (!workspace || !source) return;
    if (source.status !== "PENDING" && source.status !== "PROCESSING") return;

    const interval = setInterval(() => {
      loadSourceDetails(workspace.id, true);
    }, 2500);

    return () => clearInterval(interval);
  }, [workspace, source]);

  const handleReindex = async () => {
    if (!workspace) return;
    setReindexing(true);
    try {
      await apiFetch(`/api/v1/workspaces/${workspace.id}/knowledge/sources/${sourceId}/reindex`, {
        method: "POST",
      });
      setReindexSuccess(true);
      setTimeout(() => setReindexSuccess(false), 3000);
      loadSourceDetails(workspace.id);
    } catch (err: any) {
      setDialogConfig({
        isOpen: true,
        type: "error",
        title: "Reindex Failed",
        description: err.message || "Failed to trigger reindexing for this knowledge source.",
        confirmText: "Close",
        onConfirm: () => setDialogConfig(null),
      });
    } finally {
      setReindexing(false);
    }
  };

  const handleArchive = () => {
    if (!workspace) return;
    setDialogConfig({
      isOpen: true,
      type: "confirm",
      confirmVariant: "danger",
      title: "Archive Knowledge Source?",
      description:
        "Are you sure you want to archive this knowledge source? It will be immediately removed from AI receptionist answers.",
      confirmText: "Archive Source",
      cancelText: "Cancel",
      onConfirm: async () => {
        setDialogConfig(null);
        try {
          await apiFetch(`/api/v1/workspaces/${workspace.id}/knowledge/sources/${sourceId}/archive`, {
            method: "POST",
          });
          loadSourceDetails(workspace.id);
        } catch (err: any) {
          setDialogConfig({
            isOpen: true,
            type: "error",
            title: "Archive Failed",
            description: err.message || "Failed to archive knowledge source.",
            confirmText: "Close",
            onConfirm: () => setDialogConfig(null),
          });
        }
      },
      onCancel: () => setDialogConfig(null),
    });
  };

  if (loading) {
    return (
      <div className="p-16 flex flex-col items-center justify-center text-slate-500 max-w-5xl mx-auto">
        <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs">Loading knowledge source details...</p>
      </div>
    );
  }

  if (!source) {
    return (
      <div className="p-16 flex flex-col items-center justify-center text-center text-slate-500 max-w-5xl mx-auto">
        <BookOpen className="w-12 h-12 text-slate-700 mb-3" />
        <h3 className="text-sm font-semibold text-slate-300">Knowledge source not found</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
          This knowledge source could not be found or has been removed.
        </p>
        <Link
          href="/knowledge"
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium"
        >
          Back to Knowledge Base
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back button */}
      <div>
        <Link
          href="/knowledge"
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Knowledge Base</span>
        </Link>
      </div>

      {/* Main Details Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-bold text-white">{source.name}</h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                {source.type}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-medium uppercase tracking-wide ${
                  source.status === "READY"
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
                    : source.status === "PROCESSING"
                      ? "bg-amber-500/15 text-amber-300 border border-amber-500/20"
                      : source.status === "FAILED"
                        ? "bg-rose-500/15 text-rose-300 border border-rose-500/20"
                        : "bg-slate-800 text-slate-400 border border-slate-700"
                }`}
              >
                {source.status === "READY" && <CheckCircle2 className="w-3 h-3" />}
                {source.status}
              </span>
            </div>

            {source.sourceUrl && (
              <a
                href={source.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-indigo-400 hover:text-indigo-300 font-mono mt-1 block truncate"
              >
                {source.sourceUrl}
              </a>
            )}

            {source.description && (
              <p className="text-xs text-slate-400 mt-2 leading-relaxed max-w-2xl">
                {source.description}
              </p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={reindexing || source.status === "ARCHIVED"}
              onClick={handleReindex}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-colors disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${reindexing ? "animate-spin text-indigo-400" : ""}`} />
              <span>{reindexing ? "Reindexing..." : "Reindex"}</span>
            </button>

            {source.status !== "ARCHIVED" && (
              <button
                type="button"
                onClick={handleArchive}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-rose-900/30 text-rose-300 rounded-lg text-xs font-medium border border-slate-700 hover:border-rose-800 transition-colors"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Archive</span>
              </button>
            )}

            {reindexSuccess && (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                Queued
              </span>
            )}
          </div>
        </div>

        {source.errorMessageSafe && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{source.errorMessageSafe}</span>
          </div>
        )}

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-800/80 text-xs">
          <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/60">
            <span className="text-slate-500 text-[11px] block mb-1">Embedding Model</span>
            <span className="font-mono text-slate-200 font-medium">{source.embeddingModel}</span>
          </div>

          <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/60">
            <span className="text-slate-500 text-[11px] block mb-1">Total Chunks</span>
            <span className="font-bold text-indigo-400 text-sm">{source._count?.chunks || 0}</span>
          </div>

          <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/60">
            <span className="text-slate-500 text-[11px] block mb-1">Indexed Documents</span>
            <span className="font-bold text-slate-200 text-sm">{source._count?.documents || 0}</span>
          </div>

          <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800/60">
            <span className="text-slate-500 text-[11px] block mb-1">Last Indexed</span>
            <span className="text-slate-300 text-[11px]">
              {source.lastIndexedAt
                ? new Date(source.lastIndexedAt).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Never"}
            </span>
          </div>
        </div>
      </div>

      {/* Assigned Receptionists Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Bot className="w-4 h-4 text-indigo-400" />
          <span>Assigned AI Receptionists ({source.receptionists?.length || 0})</span>
        </h2>
        {source.receptionists && source.receptionists.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {source.receptionists.map((r: any) => (
              <Link
                key={r.receptionist.id}
                href={`/receptionists/${r.receptionist.id}`}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-950/60 border border-slate-800 hover:border-slate-700 text-slate-200 rounded-lg text-xs transition-colors"
              >
                <span className="font-medium text-white">{r.receptionist.name}</span>
                <span className="text-[11px] text-slate-500">({r.receptionist.roleTitle})</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic">
            This knowledge source is currently not assigned to any receptionist. Configure receptionist assignments in the AI Receptionist Builder.
          </p>
        )}
      </div>

      {/* Indexed Documents Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>Indexed Documents & Pages ({documents.length})</span>
          </h2>
        </div>

        {documents.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-4">No documents indexed yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-medium">
                  <th className="py-2.5 px-3">Document Title</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Generated Chunks</th>
                  <th className="py-2.5 px-3">Indexed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-200 block">{doc.title}</span>
                        {doc.metadata?.category && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wider uppercase bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
                            {doc.metadata.category}
                          </span>
                        )}
                      </div>
                      {doc.metadata?.summary && (
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          {doc.metadata.summary}
                        </span>
                      )}
                      {doc.externalUrl && !doc.metadata?.summary && (
                        <span className="text-[11px] text-slate-500 font-mono block mt-0.5">
                          {doc.externalUrl}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        {doc.status}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono text-indigo-300">{doc.chunkCount} chunks</span>
                    </td>
                    <td className="py-3 px-3 text-slate-500 text-[11px]">
                      {doc.indexedAt
                        ? new Date(doc.indexedAt).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Index Generation History */}
      {source.generations && source.generations.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            <span>Indexing Generations (Atomic Reindex Log)</span>
          </h2>
          <div className="space-y-2">
            {source.generations.map((gen: any) => (
              <div
                key={gen.id}
                className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono font-semibold text-indigo-300">
                    Gen #{gen.generation}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      gen.status === "COMPLETED"
                        ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-300 border border-rose-500/20"
                    }`}
                  >
                    {gen.status}
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    {gen.documentCount} docs • {gen.chunkCount} chunks
                  </span>
                </div>
                <span className="text-slate-500 text-[11px]">
                  {new Date(gen.startedAt).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Themed Dialog */}
      {dialogConfig && (
        <ThemedDialog
          isOpen={dialogConfig.isOpen}
          type={dialogConfig.type}
          title={dialogConfig.title}
          description={dialogConfig.description}
          confirmText={dialogConfig.confirmText}
          cancelText={dialogConfig.cancelText}
          confirmVariant={dialogConfig.confirmVariant}
          onConfirm={dialogConfig.onConfirm}
          onCancel={dialogConfig.onCancel || (() => setDialogConfig(null))}
        />
      )}
    </div>
  );
}
