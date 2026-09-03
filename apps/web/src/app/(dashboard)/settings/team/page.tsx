"use client";

import React, { useState, useEffect } from "react";
import { SettingsNav } from "@/components/SettingsNav";
import { Card, Button, Badge, Input } from "@receptionai/ui";
import { UserPlus, Trash2, Mail, ShieldAlert, Check } from "lucide-react";
import { apiFetch, ApiException } from "@/lib/api";

interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: "OWNER" | "ADMIN" | "AGENT_MANAGER" | "RECEPTION_STAFF" | "VIEWER";
  status: "ACTIVE" | "DISABLED";
  createdAt: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
}

export default function TeamSettingsPage() {
  const [workspaceId, setWorkspaceId] = useState("");
  const [currentUserRole, setCurrentUserRole] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Member["role"]>("RECEPTION_STAFF");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = async () => {
    try {
      const me = await apiFetch<{
        memberships: Array<{
          role: string;
          workspace: { id: string };
        }>;
      }>("/api/v1/auth/me");

      const wsId = me.memberships[0]?.workspace.id;
      if (!wsId) return;

      setWorkspaceId(wsId);
      setCurrentUserRole(me.memberships[0]?.role || "");

      const teamData = await apiFetch<{
        members: Member[];
        invitations: Invitation[];
      }>(`/api/v1/workspaces/${wsId}/members`);

      setMembers(teamData.members);
      setInvitations(teamData.invitations);
    } catch {
      // Ignored if unauth
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await apiFetch(`/api/v1/workspaces/${workspaceId}/invitations`, {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      setSuccessMsg(`Invitation dispatched to ${inviteEmail}.`);
      setInviteEmail("");
      setShowInviteModal(false);
      loadData();
    } catch (err) {
      if (err instanceof ApiException) {
        setError(err.error.message);
      } else {
        setError("Failed to dispatch invitation.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: Member["role"]) => {
    setError(null);
    try {
      await apiFetch(`/api/v1/workspaces/${workspaceId}/members/${memberId}`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole }),
      });
      loadData();
    } catch (err) {
      if (err instanceof ApiException) {
        setError(err.error.message);
      }
    }
  };

  const handleStatusToggle = async (member: Member) => {
    setError(null);
    const newStatus = member.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    try {
      await apiFetch(`/api/v1/workspaces/${workspaceId}/members/${member.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      loadData();
    } catch (err) {
      if (err instanceof ApiException) {
        setError(err.error.message);
      }
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this member from the workspace?")) return;
    setError(null);
    try {
      await apiFetch(`/api/v1/workspaces/${workspaceId}/members/${memberId}`, {
        method: "DELETE",
      });
      loadData();
    } catch (err) {
      if (err instanceof ApiException) {
        setError(err.error.message);
      }
    }
  };

  const canManage = currentUserRole === "OWNER" || currentUserRole === "ADMIN";

  return (
    <div>
      <SettingsNav />

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Team Members & Access</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Control workspace roles, permissions, and pending invitations.
            </p>
          </div>

          {canManage && (
            <Button size="sm" onClick={() => setShowInviteModal(true)}>
              <UserPlus className="h-3.5 w-3.5 mr-1.5" />
              Invite Member
            </Button>
          )}
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

        {/* Members Table */}
        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
              Active Workspace Members ({members.length})
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="px-5 py-3">Member</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Joined</th>
                  {canManage && <th className="px-5 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-900/40 transition">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-200 text-xs">
                          {m.name[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-white">{m.name}</p>
                          <p className="text-[11px] text-slate-400">{m.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      {canManage && currentUserRole === "OWNER" ? (
                        <select
                          value={m.role}
                          onChange={(e) => handleRoleChange(m.id, e.target.value as Member["role"])}
                          className="rounded bg-slate-900 border border-slate-800 px-2 py-1 text-xs text-slate-200"
                        >
                          <option value="OWNER">OWNER</option>
                          <option value="ADMIN">ADMIN</option>
                          <option value="AGENT_MANAGER">AGENT_MANAGER</option>
                          <option value="RECEPTION_STAFF">RECEPTION_STAFF</option>
                          <option value="VIEWER">VIEWER</option>
                        </select>
                      ) : (
                        <Badge variant={m.role === "OWNER" ? "purple" : "default"}>{m.role}</Badge>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      <Badge variant={m.status === "ACTIVE" ? "success" : "danger"}>
                        {m.status}
                      </Badge>
                    </td>

                    <td className="px-5 py-3.5 text-slate-400">
                      {new Date(m.createdAt).toLocaleDateString()}
                    </td>

                    {canManage && (
                      <td className="px-5 py-3.5 text-right space-x-2">
                        <button
                          onClick={() => handleStatusToggle(m)}
                          className="text-[11px] text-slate-400 hover:text-slate-200 font-medium"
                        >
                          {m.status === "ACTIVE" ? "Disable" : "Enable"}
                        </button>
                        <button
                          onClick={() => handleRemoveMember(m.id)}
                          className="text-slate-500 hover:text-rose-400 transition"
                          title="Remove Member"
                        >
                          <Trash2 className="h-3.5 w-3.5 inline" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Pending Invitations Table */}
        {invitations.length > 0 && (
          <Card className="p-0 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-indigo-400" />
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                Pending Invitations ({invitations.length})
              </h3>
            </div>
            <div className="divide-y divide-slate-800 text-xs">
              {invitations.map((inv) => (
                <div key={inv.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">{inv.email}</p>
                    <p className="text-[11px] text-slate-500">
                      Expires {new Date(inv.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="warning">{inv.role}</Badge>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 space-y-4 bg-slate-900 border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Invite New Team Member</h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-slate-500 hover:text-slate-300 text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleInvite} className="space-y-4">
              <Input
                id="inviteEmail"
                type="email"
                label="Member Email"
                placeholder="colleague@example.com"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300">Workspace Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as Member["role"])}
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {currentUserRole === "OWNER" && <option value="OWNER">OWNER</option>}
                  <option value="ADMIN">ADMIN</option>
                  <option value="AGENT_MANAGER">AGENT_MANAGER</option>
                  <option value="RECEPTION_STAFF">RECEPTION_STAFF</option>
                  <option value="VIEWER">VIEWER</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowInviteModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" isLoading={isLoading}>
                  Send Invitation
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
