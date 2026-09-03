"use client";

import React, { useState, useEffect } from "react";
import { SettingsNav } from "@/components/SettingsNav";
import { Card, Button, Badge, Input } from "@receptionai/ui";
import { ShieldCheck, Laptop, Globe, Trash2, KeyRound } from "lucide-react";
import { apiFetch, ApiException } from "@/lib/api";

interface SessionItem {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  lastUsedAt: string;
  createdAt: string;
  isCurrent: boolean;
}

export default function SecuritySettingsPage() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadSessions = async () => {
    try {
      const data = await apiFetch<SessionItem[]>("/api/v1/security/sessions");
      setSessions(data);
    } catch {
      // Unauth
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      await apiFetch("/api/v1/security/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setSuccessMsg(
        "Password updated successfully. All other active sessions have been invalidated."
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      loadSessions();
    } catch (err) {
      if (err instanceof ApiException) {
        setError(err.error.message);
      } else {
        setError("Failed to change password.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await apiFetch(`/api/v1/security/sessions/${sessionId}`, { method: "DELETE" });
      loadSessions();
    } catch {
      // error
    }
  };

  const handleRevokeOthers = async () => {
    try {
      await apiFetch("/api/v1/security/sessions/revoke-others", { method: "POST" });
      loadSessions();
      setSuccessMsg("All other active sessions have been logged out.");
    } catch {
      // error
    }
  };

  return (
    <div>
      <SettingsNav />

      <div className="max-w-4xl space-y-6">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">Security & Sessions</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage your account credentials, active login sessions, and token revocation.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
            {successMsg}
          </div>
        )}

        {/* Change Password Card */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
            <KeyRound className="h-4 w-4 text-indigo-400" />
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
              Change Account Password
            </h3>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
            <Input
              id="currentPassword"
              type="password"
              label="Current Password"
              placeholder="••••••••"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />

            <Input
              id="newPassword"
              type="password"
              label="New Password (min 8 characters)"
              placeholder="••••••••"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />

            <Input
              id="confirmPassword"
              type="password"
              label="Confirm New Password"
              placeholder="••••••••"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />

            <Button type="submit" size="sm" isLoading={isLoading}>
              Update Password
            </Button>
          </form>
        </Card>

        {/* Active Sessions Card */}
        <Card className="p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                Active Browser Sessions ({sessions.length})
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Cryptographically hashed server-managed session tokens.
              </p>
            </div>

            {sessions.length > 1 && (
              <Button variant="secondary" size="sm" onClick={handleRevokeOthers}>
                Revoke All Other Sessions
              </Button>
            )}
          </div>

          <div className="divide-y divide-slate-800 text-xs">
            {sessions.map((s) => (
              <div key={s.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-slate-800 text-slate-400 mt-0.5">
                    <Laptop className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-white truncate max-w-md">
                        {s.userAgent || "Unknown Client"}
                      </p>
                      {s.isCurrent && <Badge variant="success">Current Session</Badge>}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Globe className="h-3 w-3" /> {s.ipAddress || "127.0.0.1"}
                      </span>
                      <span>•</span>
                      <span>Last active: {new Date(s.lastUsedAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div>
                  {!s.isCurrent && (
                    <button
                      onClick={() => handleRevokeSession(s.id)}
                      className="text-xs text-rose-400 hover:text-rose-300 font-medium"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
