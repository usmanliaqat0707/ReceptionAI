"use client";

import React from "react";
import { Boxes } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-base font-bold text-white tracking-tight">External Integrations</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Connect your Google Calendar, Outlook, CRM systems, and custom webhooks.
        </p>
      </div>

      <EmptyState
        icon={Boxes}
        title="No Integrations Connected"
        description="Calendar sync (Google/Outlook), CRM systems (HubSpot/Salesforce), and webhook endpoints will be configurable in Phase 3."
        badge="Coming in Phase 3"
      />
    </div>
  );
}
