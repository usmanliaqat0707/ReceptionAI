"use client";

import React, { useState, useEffect } from "react";
import { SettingsNav } from "@/components/SettingsNav";
import {
  Send,
  Mail,
  MessageSquare,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Save,
  Trash2,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface CommunicationSettings {
  smsEnabled: boolean;
  emailEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  timezone: string;
  sendSmsOnBooking: boolean;
  sendEmailOnBooking: boolean;
  sendSmsOnReschedule: boolean;
  sendEmailOnReschedule: boolean;
  sendSmsOnCancellation: boolean;
  sendEmailOnCancellation: boolean;
  sendSmsOnCallbackRequest: boolean;
  sendEmailOnCallbackRequest: boolean;
  sendEmailOnNewLead: boolean;
  sendEmailOnNewMessage: boolean;
  teamNotificationEmails: string[];
}

interface SuppressionItem {
  id: string;
  channel: "SMS" | "EMAIL";
  address: string;
  reason: string;
  notes?: string | null;
  createdAt: string;
}

export default function CommunicationSettingsPage() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [settings, setSettings] = useState<CommunicationSettings | null>(null);
  const [suppressions, setSuppressions] = useState<SuppressionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [newTeamEmail, setNewTeamEmail] = useState("");

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

  const loadData = () => {
    if (!workspaceId) return;
    setLoading(true);

    Promise.all([
      apiFetch<{ settings: CommunicationSettings }>(
        `/api/v1/workspaces/${workspaceId}/communications/settings`
      ),
      apiFetch<{ suppressions: SuppressionItem[] }>(
        `/api/v1/workspaces/${workspaceId}/communications/suppressions`
      ),
    ])
      .then(([settingsRes, suppRes]) => {
        setSettings(settingsRes.settings);
        setSuppressions(suppRes.suppressions);
      })
      .catch((err) => console.error("Error loading settings:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (workspaceId) {
      loadData();
    }
  }, [workspaceId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !settings) return;

    setSaving(true);
    setSaveSuccess(false);

    try {
      const res = await apiFetch<{ settings: CommunicationSettings }>(
        `/api/v1/workspaces/${workspaceId}/communications/settings`,
        {
          method: "PUT",
          body: JSON.stringify(settings),
        }
      );
      setSettings(res.settings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      alert(`Failed to save settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveSuppression = async (id: string) => {
    if (!workspaceId) return;
    if (!confirm("Are you sure you want to unblock this address?")) return;

    try {
      await apiFetch(`/api/v1/workspaces/${workspaceId}/communications/suppressions/${id}`, {
        method: "DELETE",
      });
      setSuppressions((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      alert(`Failed to remove suppression: ${err.message}`);
    }
  };

  const handleAddTeamEmail = () => {
    if (!newTeamEmail || !newTeamEmail.includes("@")) return;
    if (settings && !settings.teamNotificationEmails.includes(newTeamEmail.trim())) {
      setSettings({
        ...settings,
        teamNotificationEmails: [...settings.teamNotificationEmails, newTeamEmail.trim()],
      });
      setNewTeamEmail("");
    }
  };

  const handleRemoveTeamEmail = (emailToRemove: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      teamNotificationEmails: settings.teamNotificationEmails.filter((e) => e !== emailToRemove),
    });
  };

  if (loading || !settings) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <SettingsNav />
        <div className="py-16 text-center text-slate-500">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-400 mb-2" />
          Loading communication policies...
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <SettingsNav />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Send className="h-5 w-5 text-indigo-400" /> Messaging & Notification Policies
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure automated transactional confirmations, quiet hours, and channel suppression controls.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow transition"
        >
          {saving ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : saveSuccess ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {saveSuccess ? "Changes Saved!" : "Save Policy"}
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        {/* 1. Channel Master Toggles */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-indigo-400" /> Channel Enablement
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-sky-400" />
                <div>
                  <p className="text-xs font-semibold text-white">SMS Notifications</p>
                  <p className="text-[11px] text-slate-400">Enable text message dispatches</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.smsEnabled}
                onChange={(e) => setSettings({ ...settings, smsEnabled: e.target.checked })}
                className="h-4 w-4 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-indigo-400" />
                <div>
                  <p className="text-xs font-semibold text-white">Email Notifications</p>
                  <p className="text-[11px] text-slate-400">Enable automated email dispatches</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.emailEnabled}
                onChange={(e) => setSettings({ ...settings, emailEnabled: e.target.checked })}
                className="h-4 w-4 rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* 2. Automated Event Triggers */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Send className="h-4 w-4 text-indigo-400" /> Automated Event Triggers
          </h3>
          <div className="divide-y divide-slate-800/60 text-xs">
            {/* Appointment Booked */}
            <div className="py-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">Appointment Confirmed</p>
                <p className="text-slate-400 text-[11px]">Send confirmation when caller books an appointment</p>
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.sendSmsOnBooking}
                    onChange={(e) => setSettings({ ...settings, sendSmsOnBooking: e.target.checked })}
                    className="h-3.5 w-3.5 rounded bg-slate-950 border-slate-700 text-indigo-600"
                  />
                  SMS
                </label>
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.sendEmailOnBooking}
                    onChange={(e) => setSettings({ ...settings, sendEmailOnBooking: e.target.checked })}
                    className="h-3.5 w-3.5 rounded bg-slate-950 border-slate-700 text-indigo-600"
                  />
                  Email
                </label>
              </div>
            </div>

            {/* Appointment Rescheduled */}
            <div className="py-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">Appointment Rescheduled</p>
                <p className="text-slate-400 text-[11px]">Send updated time notice when appointment changes</p>
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.sendSmsOnReschedule}
                    onChange={(e) => setSettings({ ...settings, sendSmsOnReschedule: e.target.checked })}
                    className="h-3.5 w-3.5 rounded bg-slate-950 border-slate-700 text-indigo-600"
                  />
                  SMS
                </label>
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.sendEmailOnReschedule}
                    onChange={(e) => setSettings({ ...settings, sendEmailOnReschedule: e.target.checked })}
                    className="h-3.5 w-3.5 rounded bg-slate-950 border-slate-700 text-indigo-600"
                  />
                  Email
                </label>
              </div>
            </div>

            {/* Appointment Cancelled */}
            <div className="py-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">Appointment Cancelled</p>
                <p className="text-slate-400 text-[11px]">Send cancellation notice when appointment is cancelled</p>
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.sendSmsOnCancellation}
                    onChange={(e) => setSettings({ ...settings, sendSmsOnCancellation: e.target.checked })}
                    className="h-3.5 w-3.5 rounded bg-slate-950 border-slate-700 text-indigo-600"
                  />
                  SMS
                </label>
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.sendEmailOnCancellation}
                    onChange={(e) => setSettings({ ...settings, sendEmailOnCancellation: e.target.checked })}
                    className="h-3.5 w-3.5 rounded bg-slate-950 border-slate-700 text-indigo-600"
                  />
                  Email
                </label>
              </div>
            </div>

            {/* Callback Request */}
            <div className="py-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">Callback Request Confirmed</p>
                <p className="text-slate-400 text-[11px]">Acknowledge caller callback request via SMS</p>
              </div>
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.sendSmsOnCallbackRequest}
                  onChange={(e) => setSettings({ ...settings, sendSmsOnCallbackRequest: e.target.checked })}
                  className="h-3.5 w-3.5 rounded bg-slate-950 border-slate-700 text-indigo-600"
                />
                SMS
              </label>
            </div>

            {/* Team Alerts */}
            <div className="py-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">Team Alerts: New Lead & Message</p>
                <p className="text-slate-400 text-[11px]">Email designated team members upon new lead or message</p>
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.sendEmailOnNewLead}
                    onChange={(e) => setSettings({ ...settings, sendEmailOnNewLead: e.target.checked })}
                    className="h-3.5 w-3.5 rounded bg-slate-950 border-slate-700 text-indigo-600"
                  />
                  Lead Alert
                </label>
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.sendEmailOnNewMessage}
                    onChange={(e) => setSettings({ ...settings, sendEmailOnNewMessage: e.target.checked })}
                    className="h-3.5 w-3.5 rounded bg-slate-950 border-slate-700 text-indigo-600"
                  />
                  Message Alert
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Quiet Hours Policy */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-400" /> Quiet Hours Enforcement
            </h3>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.quietHoursEnabled}
                onChange={(e) => setSettings({ ...settings, quietHoursEnabled: e.target.checked })}
                className="h-4 w-4 rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500"
              />
              Enable Quiet Hours
            </label>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Holds non-urgent outbound notifications during off-hours (e.g. night time). Immediate appointment
            confirmations after booking bypass quiet hours.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Start Time (24h)</label>
              <input
                type="time"
                value={settings.quietHoursStart || "21:00"}
                onChange={(e) => setSettings({ ...settings, quietHoursStart: e.target.value })}
                disabled={!settings.quietHoursEnabled}
                className="w-full bg-slate-950 border border-slate-800 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">End Time (24h)</label>
              <input
                type="time"
                value={settings.quietHoursEnd || "08:00"}
                onChange={(e) => setSettings({ ...settings, quietHoursEnd: e.target.value })}
                disabled={!settings.quietHoursEnabled}
                className="w-full bg-slate-950 border border-slate-800 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Timezone</label>
              <input
                type="text"
                value={settings.timezone}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 text-white rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* 4. Suppressions List */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-purple-400" /> Channel Suppression & Opt-Out List
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Recipients who have opted out (e.g. STOP text) or whose addresses bounced are automatically blocked.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                  <th className="py-2 px-3">Channel</th>
                  <th className="py-2 px-3">Address</th>
                  <th className="py-2 px-3">Reason</th>
                  <th className="py-2 px-3">Date Added</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {suppressions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-500">
                      No addresses currently suppressed.
                    </td>
                  </tr>
                ) : (
                  suppressions.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-800/40">
                      <td className="py-2 px-3 font-semibold text-white">{s.channel}</td>
                      <td className="py-2 px-3 font-mono text-slate-200">{s.address}</td>
                      <td className="py-2 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-950/70 text-purple-300 border border-purple-800">
                          {s.reason}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-400 text-[11px]">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveSuppression(s.id)}
                          className="text-rose-400 hover:text-rose-300 text-xs inline-flex items-center gap-1 font-medium transition"
                        >
                          <Trash2 className="h-3 w-3" /> Unblock
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </form>
    </div>
  );
}
