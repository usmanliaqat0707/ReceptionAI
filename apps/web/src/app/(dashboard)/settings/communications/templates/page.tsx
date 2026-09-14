"use client";

import React, { useState, useEffect } from "react";
import { SettingsNav } from "@/components/SettingsNav";
import {
  FileText,
  Send,
  Mail,
  MessageSquare,
  Edit2,
  Plus,
  RefreshCw,
  CheckCircle2,
  Tag,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface CommunicationTemplate {
  id: string;
  name: string;
  channel: "SMS" | "EMAIL";
  purpose: string;
  subject?: string | null;
  body: string;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  variables: string[];
  isDefault: boolean;
  updatedAt: string;
}

export default function CommunicationTemplatesPage() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [channelFilter, setChannelFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<CommunicationTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewVars, setPreviewVars] = useState<Record<string, string>>({
    customer_first_name: "Alex",
    customer_name: "Alex Morgan",
    business_name: "Apex Solutions",
    service_name: "General Consultation",
    appointment_date: "Tomorrow at 2:00 PM",
    appointment_time: "2:00 PM",
    reschedule_link: "https://example.com/reschedule",
    cancel_link: "https://example.com/cancel",
  });

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

  const fetchTemplates = () => {
    if (!workspaceId) return;
    setLoading(true);

    const query = new URLSearchParams();
    if (channelFilter !== "ALL") query.set("channel", channelFilter);

    apiFetch<{ templates: CommunicationTemplate[] }>(
      `/api/v1/workspaces/${workspaceId}/communications/templates?${query.toString()}`
    )
      .then((res) => setTemplates(res.templates))
      .catch((err) => console.error("Failed to load templates:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (workspaceId) {
      fetchTemplates();
    }
  }, [workspaceId, channelFilter]);

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !editingTemplate) return;

    setSaving(true);
    try {
      if (editingTemplate.id && !editingTemplate.id.startsWith("new_")) {
        // Update existing template
        await apiFetch(
          `/api/v1/workspaces/${workspaceId}/communications/templates/${editingTemplate.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              subject: editingTemplate.subject || undefined,
              body: editingTemplate.body,
              status: editingTemplate.status,
            }),
          }
        );
      } else {
        // Create new template
        await apiFetch(`/api/v1/workspaces/${workspaceId}/communications/templates`, {
          method: "POST",
          body: JSON.stringify({
            name: editingTemplate.name,
            channel: editingTemplate.channel,
            purpose: editingTemplate.purpose,
            subject: editingTemplate.subject || undefined,
            body: editingTemplate.body,
          }),
        });
      }

      setEditingTemplate(null);
      fetchTemplates();
    } catch (err: any) {
      alert(`Error saving template: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const renderPreview = (text: string) => {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return previewVars[key] || match;
    });
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <SettingsNav />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <FileText className="h-5 w-5 text-indigo-400" /> Communication Templates
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Server-controlled templates for SMS and email notifications with safe dynamic variable interpolation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
            {(["ALL", "SMS", "EMAIL"] as const).map((ch) => (
              <button
                key={ch}
                onClick={() => setChannelFilter(ch)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                  channelFilter === ch ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {ch === "ALL" ? "All" : ch}
              </button>
            ))}
          </div>

          <button
            onClick={() =>
              setEditingTemplate({
                id: `new_${Date.now()}`,
                name: "Custom Notification",
                channel: "SMS",
                purpose: "CUSTOM_TRANSACTIONAL",
                body: "Hello {{customer_first_name}}, this is {{business_name}}.",
                status: "ACTIVE",
                variables: ["customer_first_name", "business_name"],
                isDefault: false,
                updatedAt: new Date().toISOString(),
              })
            }
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow transition"
          >
            <Plus className="h-3.5 w-3.5" /> New Template
          </button>
        </div>
      </div>

      {/* Templates List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-16 text-center text-slate-500">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-400 mb-2" />
            Loading templates...
          </div>
        ) : templates.length === 0 ? (
          <div className="py-16 text-center bg-slate-900 border border-slate-800 rounded-xl">
            <p className="text-xs text-slate-400">No communication templates found.</p>
          </div>
        ) : (
          templates.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 p-5 rounded-xl transition shadow-sm"
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5 mb-1.5">
                    {tpl.channel === "SMS" ? (
                      <span className="p-1 rounded bg-sky-950/70 text-sky-400 border border-sky-800">
                        <MessageSquare className="h-3.5 w-3.5" />
                      </span>
                    ) : (
                      <span className="p-1 rounded bg-indigo-950/70 text-indigo-400 border border-indigo-800">
                        <Mail className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <h3 className="text-sm font-bold text-white tracking-tight">{tpl.name}</h3>
                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {tpl.purpose}
                    </span>
                    {tpl.isDefault && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                        Default System Template
                      </span>
                    )}
                  </div>

                  {tpl.subject && (
                    <p className="text-xs font-semibold text-slate-300 mb-2">
                      Subject: <span className="text-white">{tpl.subject}</span>
                    </p>
                  )}

                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 whitespace-pre-wrap mb-3 max-w-3xl">
                    {tpl.body}
                  </div>

                  {/* Variables */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-slate-500 flex items-center gap-1 mr-1">
                      <Tag className="h-3 w-3" /> Variables:
                    </span>
                    {tpl.variables?.map((v) => (
                      <span
                        key={v}
                        className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700"
                      >
                        {"{{" + v + "}}"}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => setEditingTemplate(tpl)}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
                >
                  <Edit2 className="h-3 w-3" /> Edit Template
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Template Edit / Create Modal */}
      {editingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <Edit2 className="h-4 w-4 text-indigo-400" />
              {editingTemplate.id.startsWith("new_") ? "Create New Template" : "Edit Template"}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Server-interpolated variables will be safely populated with caller and appointment context.
            </p>

            <form onSubmit={handleSaveTemplate} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Template Name</label>
                <input
                  type="text"
                  required
                  value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {editingTemplate.channel === "EMAIL" && (
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Subject Line</label>
                  <input
                    type="text"
                    value={editingTemplate.subject || ""}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Message Body</label>
                <textarea
                  rows={5}
                  required
                  value={editingTemplate.body}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, body: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Live Preview */}
              <div>
                <label className="block font-semibold text-slate-400 uppercase text-[10px] tracking-wider mb-1">
                  Simulated Render Preview
                </label>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono whitespace-pre-wrap">
                  {renderPreview(editingTemplate.body)}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingTemplate(null)}
                  className="px-4 py-2 text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg shadow transition"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="h-3 w-3 animate-spin" /> Saving...
                    </>
                  ) : (
                    "Save Template"
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
