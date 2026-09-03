"use client";

import React from "react";
import { Bot, Plus } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@receptionai/ui";

export default function ReceptionistsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-white tracking-tight">AI Receptionists</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure virtual receptionist identities, voice models, and conversation guidelines.
          </p>
        </div>

        <Button size="sm" disabled>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Create Receptionist
        </Button>
      </div>

      <EmptyState
        icon={Bot}
        title="No AI Receptionists Configured"
        description="Configure your first voice receptionist that can answer incoming calls, understand caller intent, and execute actions on behalf of your business."
        badge="Coming in Phase 2"
        actionText="Create Receptionist (Phase 2)"
        actionDisabled={true}
      />
    </div>
  );
}
