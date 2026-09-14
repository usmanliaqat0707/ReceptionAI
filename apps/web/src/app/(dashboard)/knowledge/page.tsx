"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Plus,
  Search,
  Globe,
  FileText,
  HelpCircle,
  RotateCw,
  Archive,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Bot,
  Layers,
  Upload,
  X,
  Trash2,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { ThemedDialog } from "@/components/ThemedDialog";

interface KnowledgeSourceItem {
  id: string;
  workspaceId: string;
  type: "WEBSITE" | "SITEMAP" | "PDF" | "DOCX" | "TXT" | "MARKDOWN" | "MANUAL" | "FAQ";
  name: string;
  description: string | null;
  status: "PENDING" | "PROCESSING" | "READY" | "FAILED" | "STALE" | "ARCHIVED";
  sourceUrl: string | null;
  embeddingModel: string;
  lastIndexedAt: string | null;
  lastSuccessfulIndexedAt: string | null;
  errorCode: string | null;
  errorMessageSafe: string | null;
  createdAt: string;
  documentCount: number;
  chunkCount: number;
  receptionistCount: number;
  assignedReceptionists: Array<{ id: string; name: string; roleTitle: string }>;
}

export default function KnowledgeBasePage() {
  const [workspace, setWorkspace] = useState<{ id: string; name: string } | null>(null);
  const [sources, setSources] = useState<KnowledgeSourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [showAddModal, setShowAddModal] = useState(false);

  // Add Source Modal Form State
  const [modalTab, setModalTab] = useState<"MANUAL" | "FAQ" | "WEBSITE" | "FILE">("MANUAL");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Manual Form
  const [manualTitle, setManualTitle] = useState("");
  const [manualContent, setManualContent] = useState("");

  // FAQ Form
  const [faqName, setFaqName] = useState("");
  const [faqItems, setFaqItems] = useState<Array<{ question: string; answer: string }>>([
    { question: "", answer: "" },
  ]);

  // Website Form
  const [webName, setWebName] = useState("");
  const [webUrl, setWebUrl] = useState("");

  // Themed Dialog State
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

  // File Upload Form
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    apiFetch<{ memberships: Array<{ role: string; workspace: { id: string; name: string; slug: string } }> }>(
      "/api/v1/auth/me"
    )
      .then((data: any) => {
        const memberships = data?.memberships || data?.data?.memberships || [];
        const storedSlug = typeof window !== "undefined" ? localStorage.getItem("rai_active_ws") : null;
        const selected =
          memberships.find((m: any) => m.workspace?.slug === storedSlug)?.workspace ||
          memberships[0]?.workspace;
        if (selected) {
          setWorkspace(selected);
          loadSources(selected.id);
        }
      })
      .catch((err) => console.error("Failed to load user workspace:", err));
  }, []);

  const loadSources = (workspaceId: string, silent = false) => {
    if (!silent) setLoading(true);
    apiFetch<any>(`/api/v1/workspaces/${workspaceId}/knowledge/sources`)
      .then((res) => {
        const items = Array.isArray(res) ? res : res?.data || [];
        setSources(items);
      })
      .catch((err) => console.error("Failed to fetch knowledge sources:", err))
      .finally(() => {
        if (!silent) setLoading(false);
      });
  };

  // Automatically poll while any source is actively indexing (PENDING or PROCESSING)
  useEffect(() => {
    if (!workspace) return;
    const hasActiveIndexing = sources.some(
      (s) => s.status === "PENDING" || s.status === "PROCESSING"
    );
    if (!hasActiveIndexing) return;

    const interval = setInterval(() => {
      loadSources(workspace.id, true);
    }, 2500);

    return () => clearInterval(interval);
  }, [sources, workspace]);

  const handleReindex = async (sourceId: string) => {
    if (!workspace) return;
    try {
      await apiFetch(`/api/v1/workspaces/${workspace.id}/knowledge/sources/${sourceId}/reindex`, {
        method: "POST",
      });
      setFeedback({ type: "success", message: "Reindexing initiated in background." });
      loadSources(workspace.id, true);
    } catch (err: any) {
      setDialogConfig({
        isOpen: true,
        type: "error",
        title: "Reindex Failed",
        description: err.message || "Failed to trigger reindexing for this knowledge source.",
        confirmText: "Close",
        onConfirm: () => setDialogConfig(null),
      });
    }
  };

  const handleArchive = (sourceId: string) => {
    if (!workspace) return;
    setDialogConfig({
      isOpen: true,
      type: "confirm",
      confirmVariant: "danger",
      title: "Archive Knowledge Source?",
      description:
        "Are you sure you want to archive this knowledge source? It and its documents will be immediately excluded from AI receptionist answers.",
      confirmText: "Archive Source",
      cancelText: "Cancel",
      onConfirm: async () => {
        setDialogConfig(null);
        try {
          await apiFetch(`/api/v1/workspaces/${workspace.id}/knowledge/sources/${sourceId}/archive`, {
            method: "POST",
          });
          setFeedback({ type: "success", message: "Knowledge source archived successfully." });
          loadSources(workspace.id);
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

  const handleAddFaqRow = () => {
    setFaqItems([...faqItems, { question: "", answer: "" }]);
  };

  const handleRemoveFaqRow = (index: number) => {
    if (faqItems.length === 1) return;
    setFaqItems(faqItems.filter((_, idx) => idx !== index));
  };

  const handleFaqChange = (index: number, field: "question" | "answer", value: string) => {
    const updated = [...faqItems];
    updated[index][field] = value;
    setFaqItems(updated);
  };

  const handleCreateSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace) return;
    setSubmitting(true);
    setModalError(null);

    try {
      if (modalTab === "MANUAL") {
        if (!manualTitle.trim() || !manualContent.trim()) {
          throw new Error("Title and content are required.");
        }
        await apiFetch(`/api/v1/workspaces/${workspace.id}/knowledge/sources`, {
          method: "POST",
          body: JSON.stringify({
            type: "MANUAL",
            name: manualTitle.trim(),
            configuration: {
              title: manualTitle.trim(),
              content: manualContent.trim(),
            },
          }),
        });
      } else if (modalTab === "FAQ") {
        if (!faqName.trim()) throw new Error("FAQ source name is required.");
        const validItems = faqItems.filter((i) => i.question.trim() && i.answer.trim());
        if (validItems.length === 0) throw new Error("At least one question and answer pair is required.");
        await apiFetch(`/api/v1/workspaces/${workspace.id}/knowledge/sources`, {
          method: "POST",
          body: JSON.stringify({
            type: "FAQ",
            name: faqName.trim(),
            configuration: {
              faqItems: validItems,
            },
          }),
        });
      } else if (modalTab === "WEBSITE") {
        if (!webName.trim() || !webUrl.trim()) throw new Error("Name and Root URL are required.");
        await apiFetch(`/api/v1/workspaces/${workspace.id}/knowledge/sources`, {
          method: "POST",
          body: JSON.stringify({
            type: "WEBSITE",
            name: webName.trim(),
            sourceUrl: webUrl.trim(),
            configuration: {},
          }),
        });
      } else if (modalTab === "FILE") {
        if (!uploadFile) throw new Error("Please select a file to upload.");
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const res = reader.result as string;
            const base64 = res.split(",")[1] || "";
            resolve(base64);
          };
          reader.onerror = reject;
        });
        reader.readAsDataURL(uploadFile);
        const base64Data = await base64Promise;

        await apiFetch(`/api/v1/workspaces/${workspace.id}/knowledge/sources/upload`, {
          method: "POST",
          body: JSON.stringify({
            filename: uploadFile.name,
            contentType: uploadFile.type,
            base64Data,
            sourceName: uploadName.trim() || undefined,
          }),
        });
      }

      let createdName = "";
      if (modalTab === "MANUAL") {
        createdName = manualTitle.trim();
      } else if (modalTab === "FAQ") {
        createdName = faqName.trim();
      } else if (modalTab === "WEBSITE") {
        createdName = webName.trim() || webUrl.trim();
      } else if (modalTab === "FILE") {
        createdName = uploadName.trim() || uploadFile?.name || "Uploaded File";
      }

      setShowAddModal(false);
      setFeedback({
        type: "success",
        message: `Knowledge source "${createdName}" submitted. Vector indexing is underway...`,
      });
      setTimeout(() => setFeedback(null), 8000);

      // Reset forms
      setManualTitle("");
      setManualContent("");
      setFaqName("");
      setFaqItems([{ question: "", answer: "" }]);
      setWebName("");
      setWebUrl("");
      setUploadFile(null);
      setUploadName("");
      loadSources(workspace.id);
    } catch (err: any) {
      setModalError(err.message || "Failed to create knowledge source.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSources = sources.filter((s) => {
    if (typeFilter !== "ALL" && s.type !== typeFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <BookOpen className="w-6 h-6 text-indigo-400" />
            Knowledge Base & RAG
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Approved business documentation, websites, FAQs, and files for AI receptionist retrieval.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add Knowledge</span>
        </button>
      </div>

      {/* Confirmation & Status Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/20 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search knowledge sources..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {[
            { label: "All Types", value: "ALL" },
            { label: "Manual Text", value: "MANUAL" },
            { label: "FAQ", value: "FAQ" },
            { label: "Website", value: "WEBSITE" },
            { label: "PDF / DOCX", value: "PDF" },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setTypeFilter(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                typeFilter === tab.value
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sources Grid / Table */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center text-slate-500 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
          <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs">Loading approved knowledge sources...</p>
        </div>
      ) : filteredSources.length === 0 ? (
        <div className="p-16 flex flex-col items-center justify-center text-center text-slate-500 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
          <BookOpen className="w-12 h-12 text-slate-700 mb-3" />
          <h3 className="text-sm font-semibold text-slate-300">No knowledge sources found</h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
            {search
              ? "No sources match your current search query."
              : "Add clinic guides, service policies, FAQs, or your public website to ground your AI receptionist."}
          </p>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold"
          >
            Add Your First Knowledge Source
          </button>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-medium">
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Indexed Scope</th>
                  <th className="py-3 px-4">Assigned To</th>
                  <th className="py-3 px-4">Last Indexed</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredSources.map((source) => (
                  <tr
                    key={source.id}
                    className="hover:bg-slate-800/30 transition-colors group"
                  >
                    <td className="py-3.5 px-4 max-w-xs">
                      <Link
                        href={`/knowledge/${source.id}`}
                        className="font-semibold text-white group-hover:text-indigo-400 transition-colors block truncate"
                      >
                        {source.name}
                      </Link>
                      {source.sourceUrl && (
                        <a
                          href={source.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-slate-500 hover:text-slate-400 truncate block mt-0.5"
                        >
                          {source.sourceUrl}
                        </a>
                      )}
                      {source.description && !source.sourceUrl && (
                        <span className="text-[11px] text-slate-500 truncate block mt-0.5">
                          {source.description}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                        {source.type === "WEBSITE" ? (
                          <Globe className="w-2.5 h-2.5 text-sky-400" />
                        ) : source.type === "FAQ" ? (
                          <HelpCircle className="w-2.5 h-2.5 text-amber-400" />
                        ) : (
                          <FileText className="w-2.5 h-2.5 text-indigo-400" />
                        )}
                        {source.type}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                          source.status === "READY"
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
                            : source.status === "PROCESSING" || source.status === "PENDING"
                              ? "bg-amber-500/15 text-amber-300 border border-amber-500/20"
                              : source.status === "FAILED"
                                ? "bg-rose-500/15 text-rose-300 border border-rose-500/20"
                                : "bg-slate-800 text-slate-400 border border-slate-700"
                        }`}
                      >
                        {source.status === "READY" && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                        {(source.status === "PROCESSING" || source.status === "PENDING") && (
                          <div className="w-2.5 h-2.5 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
                        )}
                        {source.status}
                      </span>
                      {source.errorMessageSafe && (
                        <span className="text-[10px] text-rose-400 block mt-0.5 truncate max-w-xs">
                          {source.errorMessageSafe}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-400">
                      <div className="flex items-center gap-2">
                        <span>{source.documentCount} docs</span>
                        <span>•</span>
                        <span className="text-slate-300 font-medium">{source.chunkCount} chunks</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {source.assignedReceptionists && source.assignedReceptionists.length > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <Bot className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="text-slate-300 font-medium">
                            {source.assignedReceptionists.map((r) => r.name).join(", ")}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-600 italic">Unassigned</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      {source.lastIndexedAt
                        ? new Date(source.lastIndexedAt).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Pending"}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleReindex(source.id)}
                          title="Reindex source"
                          className="p-1 text-slate-400 hover:text-indigo-400 transition-colors"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleArchive(source.id)}
                          title="Archive source"
                          className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                        <Link
                          href={`/knowledge/${source.id}`}
                          className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                        >
                          <span>Details</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Knowledge Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Add Knowledge Source</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-800 px-5 pt-3 gap-2 bg-slate-950/40">
              {[
                { label: "Manual Text", value: "MANUAL", icon: FileText },
                { label: "FAQ", value: "FAQ", icon: HelpCircle },
                { label: "Website", value: "WEBSITE", icon: Globe },
                { label: "Upload File", value: "FILE", icon: Upload },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setModalTab(tab.value as any)}
                    className={`flex items-center gap-1.5 pb-3 px-3 text-xs font-medium border-b-2 transition-colors ${
                      modalTab === tab.value
                        ? "border-indigo-500 text-white font-semibold"
                        : "border-transparent text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateSource} className="p-5 space-y-4">
              {modalError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 text-xs text-rose-300">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Tab 1: Manual Text */}
              {modalTab === "MANUAL" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">
                      Document Title
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Clinical Cancellation & Arrival Policy"
                      value={manualTitle}
                      onChange={(e) => setManualTitle(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">
                      Content (Markdown or Plain Text)
                    </label>
                    <textarea
                      rows={8}
                      placeholder="Enter verified business facts, service definitions, or clinic instructions..."
                      value={manualContent}
                      onChange={(e) => setManualContent(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 leading-relaxed"
                    />
                  </div>
                </div>
              )}

              {/* Tab 2: FAQ */}
              {modalTab === "FAQ" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">
                      FAQ Collection Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Patient General FAQ"
                      value={faqName}
                      onChange={(e) => setFaqName(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    {faqItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl space-y-2 relative"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-slate-400">
                            Q&A Pair #{idx + 1}
                          </span>
                          {faqItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveFaqRow(idx)}
                              className="text-slate-500 hover:text-rose-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          placeholder="Question, e.g. Do you accept emergency walk-ins?"
                          value={item.question}
                          onChange={(e) => handleFaqChange(idx, "question", e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                        <textarea
                          rows={2}
                          placeholder="Answer..."
                          value={item.answer}
                          onChange={(e) => handleFaqChange(idx, "answer", e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleAddFaqRow}
                    className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Another Question</span>
                  </button>
                </div>
              )}

              {/* Tab 3: Website */}
              {modalTab === "WEBSITE" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">
                      Website Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Bright Dental Official Website"
                      value={webName}
                      onChange={(e) => setWebName(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">
                      Root URL (HTTPS)
                    </label>
                    <input
                      type="url"
                      placeholder="https://brightdental.com"
                      value={webUrl}
                      onChange={(e) => setWebUrl(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      Protected by SSRF security. Private IPs, localhost, and cloud metadata targets are rejected.
                    </span>
                  </div>
                  <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-start gap-2.5 text-xs text-indigo-200">
                    <Sparkles className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-indigo-300">Autonomous AI Web Indexing</p>
                      <p className="text-[11px] text-indigo-300/80 mt-0.5 leading-relaxed">
                        ReceptionAI automatically discovers all internal pages across your website, using AI to extract and structure services, operating hours, booking processes, and clinic policies.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: File Upload */}
              {modalTab === "FILE" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-300 block mb-1">
                      Source Display Name (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Defaults to filename"
                      value={uploadName}
                      onChange={(e) => setUploadName(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-slate-950/40">
                    <Upload className="w-8 h-8 text-slate-400 mb-2" />
                    <input
                      type="file"
                      id="knowledge-file-upload"
                      accept=".pdf,.docx,.txt,.md,.markdown"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <label htmlFor="knowledge-file-upload" className="cursor-pointer">
                      <span className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold block">
                        Click to select a file
                      </span>
                      <span className="text-[11px] text-slate-500 mt-1 block">
                        PDF, DOCX, TXT, or Markdown (max 10MB)
                      </span>
                    </label>
                    {uploadFile && (
                      <div className="mt-3 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded-lg text-xs font-mono">
                        Selected: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-md transition-all"
                >
                  {submitting && (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>{submitting ? "Indexing..." : "Index Source"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Themed Confirmation & Error Dialog */}
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
