"use client";

import React, { useState, useEffect, useCallback } from "react";
import { SettingsNav } from "@/components/SettingsNav";
import {
  Briefcase,
  Plus,
  Clock,
  DollarSign,
  CheckCircle2,
  XCircle,
  Archive,
  Edit2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface ServiceItem {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  priceText: string | null;
  active: boolean;
  calendarIntegration?: {
    id: string;
    name: string;
    provider: string;
  } | null;
  _count: {
    appointments: number;
  };
}

interface CalendarIntegration {
  id: string;
  name: string;
  provider: string;
}

export default function ServicesSettingsPage() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [integrations, setIntegrations] = useState<CalendarIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [bufferBeforeMinutes, setBufferBeforeMinutes] = useState(0);
  const [bufferAfterMinutes, setBufferAfterMinutes] = useState(0);
  const [priceText, setPriceText] = useState("");
  const [calendarIntegrationId, setCalendarIntegrationId] = useState("");

  useEffect(() => {
    apiFetch<{ memberships: Array<{ workspace: { id: string; slug: string } }> }>(
      "/api/v1/auth/me"
    )
      .then((data) => {
        const storedSlug = localStorage.getItem("rai_active_ws");
        const match =
          data.memberships.find((m) => m.workspace.slug === storedSlug) ||
          data.memberships[0];
        if (match) setWorkspaceId(match.workspace.id);
      })
      .catch(() => {});
  }, []);

  const fetchServices = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const [srvRes, calRes] = await Promise.all([
        apiFetch<{ data: ServiceItem[] }>(`/api/v1/workspaces/${workspaceId}/services`),
        apiFetch<{ data: CalendarIntegration[] }>(
          `/api/v1/workspaces/${workspaceId}/calendar-integrations`
        ),
      ]);
      setServices(srvRes.data || []);
      setIntegrations(calRes.data || []);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const openCreateModal = () => {
    setEditingService(null);
    setName("");
    setDescription("");
    setDurationMinutes(30);
    setBufferBeforeMinutes(0);
    setBufferAfterMinutes(0);
    setPriceText("");
    setCalendarIntegrationId(integrations[0]?.id || "");
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (srv: ServiceItem) => {
    setEditingService(srv);
    setName(srv.name);
    setDescription(srv.description || "");
    setDurationMinutes(srv.durationMinutes);
    setBufferBeforeMinutes(srv.bufferBeforeMinutes);
    setBufferAfterMinutes(srv.bufferAfterMinutes);
    setPriceText(srv.priceText || "");
    setCalendarIntegrationId(srv.calendarIntegration?.id || "");
    setFormError(null);
    setShowModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !name.trim()) return;

    setSubmitting(true);
    setFormError(null);

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      durationMinutes: Number(durationMinutes),
      bufferBeforeMinutes: Number(bufferBeforeMinutes),
      bufferAfterMinutes: Number(bufferAfterMinutes),
      priceText: priceText.trim() || undefined,
      calendarIntegrationId: calendarIntegrationId || undefined,
    };

    try {
      if (editingService) {
        await apiFetch(
          `/api/v1/workspaces/${workspaceId}/services/${editingService.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          }
        );
      } else {
        await apiFetch(`/api/v1/workspaces/${workspaceId}/services`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      setShowModal(false);
      fetchServices();
    } catch (err: any) {
      setFormError(err.message || "Failed to save service.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (id: string) => {
    if (!workspaceId || !confirm("Are you sure you want to archive this service?")) return;
    try {
      await apiFetch(`/api/v1/workspaces/${workspaceId}/services/${id}`, {
        method: "DELETE",
      });
      fetchServices();
    } catch (err: any) {
      alert(err.message || "Failed to archive service.");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Workspace Settings</h1>
        <p className="text-xs text-slate-400 mt-1">
          Manage services, durations, pricing, and scheduling rules.
        </p>
      </div>

      <SettingsNav />

      {/* Services Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-indigo-400" /> Services Catalog
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Server-authoritative durations and buffers. Ava offers these services to callers.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition shadow"
        >
          <Plus className="w-3.5 h-3.5" /> Add Service
        </button>
      </div>

      {/* Services Table */}
      {loading ? (
        <div className="py-12 flex justify-center items-center text-slate-400 gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
          <span className="text-xs">Loading services catalog...</span>
        </div>
      ) : services.length === 0 ? (
        <div className="py-12 text-center p-6 rounded-xl border border-dashed border-slate-800 bg-slate-900/40">
          <Briefcase className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-xs font-semibold text-white">No Services Configured</p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto mb-4">
            Add your primary consultation, cleaning, or examination services to allow real-time appointment booking.
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500"
          >
            <Plus className="w-3.5 h-3.5" /> Create Service
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Service Name</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Buffer Before/After</th>
                <th className="py-3 px-4">Price</th>
                <th className="py-3 px-4">Calendar</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {services.map((srv) => (
                <tr key={srv.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-4">
                    <p className="font-semibold text-white">{srv.name}</p>
                    {srv.description && (
                      <p className="text-[11px] text-slate-400 line-clamp-1">
                        {srv.description}
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-200">
                      {srv.durationMinutes} mins
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    +{srv.bufferBeforeMinutes}m / +{srv.bufferAfterMinutes}m
                  </td>
                  <td className="py-3 px-4 text-slate-300 font-medium">
                    {srv.priceText || "—"}
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    {srv.calendarIntegration?.name || "Workspace Default"}
                  </td>
                  <td className="py-3 px-4">
                    {srv.active ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                        <XCircle className="w-3 h-3" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(srv)}
                        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
                        title="Edit Service"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleArchive(srv.id)}
                        className="p-1 rounded hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition"
                        title="Archive Service"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Service Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">
                {editingService ? "Edit Service" : "Add New Service"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-950/70 border border-rose-800/80 rounded-lg text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Service Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. General Consultation"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Details about what is included in this service..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Duration (min)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={480}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Buffer Before
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={bufferBeforeMinutes}
                    onChange={(e) => setBufferBeforeMinutes(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Buffer After
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={bufferAfterMinutes}
                    onChange={(e) => setBufferAfterMinutes(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Price Display Text (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. $150 or Free initial consultation"
                  value={priceText}
                  onChange={(e) => setPriceText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Calendar Integration
                </label>
                <select
                  value={calendarIntegrationId}
                  onChange={(e) => setCalendarIntegrationId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Workspace Default Integration</option>
                  {integrations.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.provider === "GOOGLE_CALENDAR" ? "Google" : "Demo"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 disabled:opacity-50 transition"
                >
                  {submitting ? "Saving..." : "Save Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
