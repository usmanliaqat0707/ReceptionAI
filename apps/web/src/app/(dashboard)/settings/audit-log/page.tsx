"use client";

import React, { useState, useEffect } from "react";
import { SettingsNav } from "@/components/SettingsNav";
import { Card, Badge, Button } from "@receptionai/ui";
import { ScrollText, ChevronLeft, ChevronRight, User, Terminal } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface AuditItem {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  actor: { id: string; name: string; email: string } | null;
  actorType: string;
  ipAddress: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface AuditResponse {
  logs: AuditItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function AuditLogPage() {
  const [workspaceId, setWorkspaceId] = useState("");
  const [logs, setLogs] = useState<AuditItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEvents, setTotalEvents] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const loadLogs = async (wsId: string, pageNum: number) => {
    setIsLoading(true);
    try {
      const data = await apiFetch<AuditResponse>(
        `/api/v1/workspaces/${wsId}/audit-logs?page=${pageNum}&limit=15`
      );
      setLogs(data.logs);
      setPage(data.pagination.page);
      setTotalPages(data.pagination.totalPages);
      setTotalEvents(data.pagination.total);
    } catch {
      // unauth or forbidden
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    apiFetch<{
      memberships: Array<{
        workspace: { id: string };
      }>;
    }>("/api/v1/auth/me").then((res) => {
      const wsId = res.memberships[0]?.workspace.id;
      if (wsId) {
        setWorkspaceId(wsId);
        loadLogs(wsId, 1);
      }
    });
  }, []);

  return (
    <div>
      <SettingsNav />

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Security Audit Trail</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Immutable record of security and administrative operations in this workspace.
            </p>
          </div>

          <Badge variant="purple">{totalEvents} Total Events</Badge>
        </div>

        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="px-5 py-3">Event Action</th>
                  <th className="px-5 py-3">Resource</th>
                  <th className="px-5 py-3">Actor</th>
                  <th className="px-5 py-3">Timestamp (UTC)</th>
                  <th className="px-5 py-3">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                      No audit events recorded yet.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-900/40 transition font-mono">
                      <td className="px-5 py-3.5 font-sans">
                        <span className="font-semibold text-indigo-400 text-xs">{log.action}</span>
                      </td>

                      <td className="px-5 py-3.5 text-slate-300 font-sans text-xs">
                        <span className="bg-slate-800 px-2 py-0.5 rounded text-[11px] border border-slate-700">
                          {log.resourceType}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 font-sans text-xs">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <User className="h-3 w-3 text-slate-400" />
                          <span>{log.actor ? log.actor.email : "System / Automated"}</span>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-slate-400 text-[11px]">
                        {new Date(log.createdAt).toISOString().replace("T", " ").slice(0, 19)}
                      </td>

                      <td className="px-5 py-3.5 text-[11px] text-slate-400 max-w-xs truncate">
                        {log.metadata ? JSON.stringify(log.metadata) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>
              Page {page} of {Math.max(1, totalPages)}
            </span>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1 || isLoading}
                onClick={() => {
                  const newPage = page - 1;
                  setPage(newPage);
                  loadLogs(workspaceId, newPage);
                }}
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
              </Button>

              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages || isLoading}
                onClick={() => {
                  const newPage = page + 1;
                  setPage(newPage);
                  loadLogs(workspaceId, newPage);
                }}
              >
                Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
