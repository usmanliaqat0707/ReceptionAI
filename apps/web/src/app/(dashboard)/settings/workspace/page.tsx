"use client";

import React, { useState, useEffect } from "react";
import { SettingsNav } from "@/components/SettingsNav";
import { Card, Button, Input } from "@receptionai/ui";
import { apiFetch, ApiException } from "@/lib/api";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Singapore",
  "Asia/Tokyo",
];

const INDUSTRIES = [
  "Dental Clinic",
  "Medical & Healthcare",
  "Legal Services",
  "Real Estate",
  "Home Services / HVAC",
  "Financial Advisory",
  "Automotive Services",
  "General Business",
];

export default function WorkspaceSettingsPage() {
  const [workspaceId, setWorkspaceId] = useState("");
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [timezone, setTimezone] = useState("");
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Get active workspace details
    apiFetch<{
      user: unknown;
      memberships: Array<{
        role: string;
        workspace: {
          id: string;
          name: string;
          slug: string;
          industry: string;
          timezone: string;
          status: string;
        };
      }>;
    }>("/api/v1/auth/me").then((res) => {
      const active = res.memberships[0];
      if (active) {
        setWorkspaceId(active.workspace.id);
        setSlug(active.workspace.slug);
        setName(active.workspace.name);
        setIndustry(active.workspace.industry);
        setTimezone(active.workspace.timezone);
        setStatus(active.workspace.status);
        setRole(active.role);
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) return;

    setMessage(null);
    setError(null);
    setIsLoading(true);

    try {
      await apiFetch(`/api/v1/workspaces/${workspaceId}`, {
        method: "PATCH",
        body: JSON.stringify({ name, industry, timezone }),
      });
      setMessage("Workspace settings updated successfully.");
    } catch (err) {
      if (err instanceof ApiException) {
        setError(err.error.message);
      } else {
        setError("Failed to update workspace settings.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isReadOnly = role !== "OWNER" && role !== "ADMIN";

  return (
    <div>
      <SettingsNav />

      <div className="max-w-3xl space-y-6">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">Workspace Configuration</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage your organization name, industry domain, and timezone.
          </p>
        </div>

        {message && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
            {message}
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
            {error}
          </div>
        )}

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="name"
              label="Workspace Name"
              required
              disabled={isReadOnly}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Workspace Slug (URL-Safe Identifier)
                </label>
                <input
                  type="text"
                  disabled
                  value={slug}
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-400 cursor-not-allowed"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Slugs are immutable after creation to protect URL routing stability.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Internal Workspace ID
                </label>
                <input
                  type="text"
                  disabled
                  value={workspaceId}
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-slate-400 font-mono cursor-not-allowed"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Canonical database identifier used for tenant isolation.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="industry" className="block text-xs font-semibold text-slate-300">
                  Business Industry
                </label>
                <select
                  id="industry"
                  disabled={isReadOnly}
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="timezone" className="block text-xs font-semibold text-slate-300">
                  Operating Timezone (IANA)
                </label>
                <select
                  id="timezone"
                  disabled={isReadOnly}
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Workspace Status:{" "}
                <span className="text-slate-300 font-medium uppercase">{status || "ACTIVE"}</span>
              </span>
              {!isReadOnly && (
                <Button type="submit" size="sm" isLoading={isLoading}>
                  Save Workspace Changes
                </Button>
              )}
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
