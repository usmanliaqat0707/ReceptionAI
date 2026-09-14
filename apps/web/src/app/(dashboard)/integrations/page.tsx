"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Boxes,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Zap,
  Clock,
  Sparkles,
  Layers,
  ArrowRight,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Integration {
  id: string;
  provider: "INTERNAL_DEMO" | "GOOGLE_CALENDAR";
  name: string;
  status: "CONNECTED" | "REAUTH_REQUIRED" | "DISCONNECTED" | "ERROR";
  externalCalendarId: string | null;
  externalAccountId: string | null;
  createdAt: string;
  _count: {
    services: number;
    appointments: number;
  };
}

function IntegrationsContent() {
  const searchParams = useSearchParams();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check URL query parameters for OAuth returns
  useEffect(() => {
    const error = searchParams.get("error");
    if (error) setErrorMessage(decodeURIComponent(error));
  }, [searchParams]);

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

  const fetchIntegrations = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ data: Integration[] }>(
        `/api/v1/workspaces/${workspaceId}/calendar-integrations`
      );
      setIntegrations(res.data || []);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const handleEnableDemo = async () => {
    if (!workspaceId) return;
    try {
      await apiFetch(
        `/api/v1/workspaces/${workspaceId}/calendar-integrations/internal-demo`,
        { method: "POST" }
      );
      fetchIntegrations();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to enable demo calendar.");
    }
  };

  const handleConnectGoogle = async () => {
    if (!workspaceId) return;
    setConnectingGoogle(true);
    setErrorMessage(null);
    try {
      const res = await apiFetch<{ data: { url: string } }>(
        `/api/v1/workspaces/${workspaceId}/calendar-integrations/google/auth-url`
      );
      if (res.data?.url) {
        window.location.href = res.data.url;
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to initialize Google OAuth.");
      setConnectingGoogle(false);
    }
  };

  const handleDisconnect = async (id: string) => {
    if (!workspaceId) return;
    try {
      await apiFetch(
        `/api/v1/workspaces/${workspaceId}/calendar-integrations/${id}/disconnect`,
        { method: "POST" }
      );
      fetchIntegrations();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to disconnect integration.");
    }
  };

  const handleReconcile = async () => {
    if (!workspaceId) return;
    setReconciling(true);
    setReconcileResult(null);
    try {
      const res = await apiFetch<{ data: any }>(
        `/api/v1/workspaces/${workspaceId}/calendar-integrations/reconcile`,
        { method: "POST" }
      );
      setReconcileResult(res.data);
      fetchIntegrations();
    } catch (err: any) {
      setErrorMessage(err.message || "Reconciliation failed.");
    } finally {
      setReconciling(false);
    }
  };

  const demoIntegration = integrations.find((i) => i.provider === "INTERNAL_DEMO");
  const googleIntegration = integrations.find((i) => i.provider === "GOOGLE_CALENDAR");

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Boxes className="h-6 w-6 text-indigo-400" />
            Calendar & Scheduling Integrations
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Connect external calendar providers to synchronize real-time availability and authorize scheduling mutations.
          </p>
        </div>

        <button
          onClick={handleReconcile}
          disabled={reconciling}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${reconciling ? "animate-spin text-indigo-400" : ""}`} />
          {reconciling ? "Reconciling..." : "Run Reconciliation"}
        </button>
      </div>

      {errorMessage && (
        <div className="p-3.5 bg-rose-950/70 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {reconcileResult && (
        <div className="p-3.5 bg-emerald-950/70 border border-emerald-800/80 rounded-xl text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>
              Reconciliation completed. Inspected: <strong>{reconcileResult.inspectedCount}</strong>, Compensated:{" "}
              <strong>{reconcileResult.compensatedCount}</strong>, External Cancellations Synced:{" "}
              <strong>{reconcileResult.syncedCancellations}</strong>.
            </span>
          </div>
          <button
            onClick={() => setReconcileResult(null)}
            className="text-emerald-400 hover:text-white text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Grid of Providers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Google Calendar Provider Card */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-4 shadow hover:border-slate-700/80 transition">
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Google Calendar</h2>
                  <p className="text-xs text-slate-400">Production Calendar Sync (OAuth 2.0)</p>
                </div>
              </div>

              {googleIntegration?.status === "CONNECTED" ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                  <CheckCircle2 className="w-3 h-3" /> Connected
                </span>
              ) : googleIntegration?.status === "REAUTH_REQUIRED" ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-950/80 text-amber-400 border border-amber-800/60">
                  <AlertTriangle className="w-3 h-3" /> Reauth Required
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400">
                  Disconnected
                </span>
              )}
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Connect a Google Workspace or personal Google Calendar account. The AI receptionist checks real-time free/busy schedules and creates calendar events with two-way sync.
            </p>

            {googleIntegration?.status === "CONNECTED" && (
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Active Calendar:</span>
                  <span className="font-semibold text-white">
                    {googleIntegration.externalCalendarId || "primary"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Booked Events:</span>
                  <span className="text-slate-300">
                    {googleIntegration._count.appointments} appointments
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-800/80">
            {googleIntegration?.status === "CONNECTED" ? (
              <button
                onClick={() => handleDisconnect(googleIntegration.id)}
                className="w-full py-2 text-xs font-semibold text-rose-300 bg-rose-950/50 hover:bg-rose-900/60 border border-rose-800/70 rounded-lg transition"
              >
                Disconnect Google Calendar
              </button>
            ) : (
              <button
                onClick={handleConnectGoogle}
                disabled={connectingGoogle}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow transition"
              >
                <Calendar className="w-3.5 h-3.5" />
                {connectingGoogle ? "Redirecting..." : "Connect Google Calendar"}
              </button>
            )}
          </div>
        </div>

        {/* Internal Demo Calendar Provider Card */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex flex-col justify-between space-y-4 shadow hover:border-slate-700/80 transition">
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">Internal Demo Calendar</h2>
                  <p className="text-xs text-slate-400">Zero-Config Local PostgreSQL Provider</p>
                </div>
              </div>

              {demoIntegration?.status === "CONNECTED" ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                  <CheckCircle2 className="w-3 h-3" /> Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400">
                  Inactive
                </span>
              )}
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Real application logic running natively on ReceptionAI without requiring third-party cloud credentials. Uses your configured business operating hours and database records.
            </p>

            {demoIntegration?.status === "CONNECTED" && (
              <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">Storage Engine:</span>
                  <span className="font-semibold text-white">PostgreSQL 16 Multi-Tenant</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Booked Events:</span>
                  <span className="text-slate-300">
                    {demoIntegration._count.appointments} appointments
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-800/80">
            {demoIntegration?.status === "CONNECTED" ? (
              <button
                onClick={() => handleDisconnect(demoIntegration.id)}
                className="w-full py-2 text-xs font-semibold text-slate-400 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg transition"
              >
                Disable Demo Provider
              </button>
            ) : (
              <button
                onClick={handleEnableDemo}
                className="w-full flex items-center justify-center gap-2 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow transition"
              >
                <Zap className="w-3.5 h-3.5" />
                Enable Internal Demo Calendar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
          <span className="text-xs">Loading calendar integrations...</span>
        </div>
      }
    >
      <IntegrationsContent />
    </Suspense>
  );
}
