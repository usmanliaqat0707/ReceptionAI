"use client";

import React, { useState, useEffect } from "react";
import { SettingsNav } from "@/components/SettingsNav";
import {
  Calendar,
  Clock,
  ShieldAlert,
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface AppointmentPolicy {
  minimumLeadTimeMinutes: number;
  maximumAdvanceDays: number;
  cancellationCutoffMinutes: number;
  rescheduleCutoffMinutes: number;
  allowSameDay: boolean;
}

export default function SchedulingPolicyPage() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form Values
  const [minimumLeadTimeMinutes, setMinimumLeadTimeMinutes] = useState(60);
  const [maximumAdvanceDays, setMaximumAdvanceDays] = useState(90);
  const [cancellationCutoffMinutes, setCancellationCutoffMinutes] = useState(1440);
  const [rescheduleCutoffMinutes, setRescheduleCutoffMinutes] = useState(1440);
  const [allowSameDay, setAllowSameDay] = useState(true);

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

  useEffect(() => {
    if (!workspaceId) return;
    setLoading(true);
    apiFetch<{ data: AppointmentPolicy }>(
      `/api/v1/workspaces/${workspaceId}/appointment-policy`
    )
      .then((res) => {
        if (res.data) {
          setMinimumLeadTimeMinutes(res.data.minimumLeadTimeMinutes);
          setMaximumAdvanceDays(res.data.maximumAdvanceDays);
          setCancellationCutoffMinutes(res.data.cancellationCutoffMinutes);
          setRescheduleCutoffMinutes(res.data.rescheduleCutoffMinutes);
          setAllowSameDay(res.data.allowSameDay);
        }
      })
      .catch((err) => setErrorMessage(err.message))
      .finally(() => setLoading(false));
  }, [workspaceId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;

    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await apiFetch(`/api/v1/workspaces/${workspaceId}/appointment-policy`, {
        method: "PUT",
        body: JSON.stringify({
          minimumLeadTimeMinutes: Number(minimumLeadTimeMinutes),
          maximumAdvanceDays: Number(maximumAdvanceDays),
          cancellationCutoffMinutes: Number(cancellationCutoffMinutes),
          rescheduleCutoffMinutes: Number(rescheduleCutoffMinutes),
          allowSameDay: Boolean(allowSameDay),
        }),
      });

      setSuccessMessage("Scheduling policy rules updated successfully.");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update policy.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Workspace Settings</h1>
        <p className="text-xs text-slate-400 mt-1">
          Manage services, durations, pricing, and scheduling rules.
        </p>
      </div>

      <SettingsNav />

      {/* Header */}
      <div>
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-400" /> Scheduling & Availability Policy
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Authoritative scheduling boundaries applied automatically to voice and manual bookings.
        </p>
      </div>

      {successMessage && (
        <div className="p-3 bg-emerald-950/70 border border-emerald-800/80 rounded-lg text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-950/70 border border-rose-800/80 rounded-lg text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {loading ? (
        <div className="py-12 flex justify-center items-center text-slate-400 gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
          <span className="text-xs">Loading scheduling policy...</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-6 shadow">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Minimum Lead Time */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-200">
                Minimum Booking Lead Time (Minutes)
              </label>
              <input
                type="number"
                min={0}
                max={10080}
                value={minimumLeadTimeMinutes}
                onChange={(e) => setMinimumLeadTimeMinutes(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                required
              />
              <p className="text-[11px] text-slate-400">
                Prevents last-minute bookings. E.g. 60 means callers cannot book a slot less than 1 hour away.
              </p>
            </div>

            {/* Maximum Advance Days */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-200">
                Maximum Advance Window (Days)
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={maximumAdvanceDays}
                onChange={(e) => setMaximumAdvanceDays(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                required
              />
              <p className="text-[11px] text-slate-400">
                Maximum number of days in the future callers are permitted to schedule.
              </p>
            </div>

            {/* Cancellation Notice Cutoff */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-200">
                Cancellation Notice Cutoff (Minutes)
              </label>
              <input
                type="number"
                min={0}
                max={10080}
                value={cancellationCutoffMinutes}
                onChange={(e) => setCancellationCutoffMinutes(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                required
              />
              <p className="text-[11px] text-slate-400">
                Minimum advance notice required to cancel (e.g. 1440 = 24 hours).
              </p>
            </div>

            {/* Reschedule Notice Cutoff */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-200">
                Rescheduling Notice Cutoff (Minutes)
              </label>
              <input
                type="number"
                min={0}
                max={10080}
                value={rescheduleCutoffMinutes}
                onChange={(e) => setRescheduleCutoffMinutes(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                required
              />
              <p className="text-[11px] text-slate-400">
                Minimum advance notice required to reschedule an existing appointment.
              </p>
            </div>
          </div>

          {/* Same Day Appointments */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-200">Allow Same-Day Appointments</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Permit callers to book open slots on the current day if the minimum lead time is satisfied.
              </p>
            </div>
            <input
              type="checkbox"
              checked={allowSameDay}
              onChange={(e) => setAllowSameDay(e.target.checked)}
              className="h-4 w-4 rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 disabled:opacity-50 transition shadow"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving Policy..." : "Save Policy"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
