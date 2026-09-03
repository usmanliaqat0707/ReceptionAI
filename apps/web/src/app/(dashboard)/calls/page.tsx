"use client";

import React from "react";
import { PhoneCall } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export default function CallsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-base font-bold text-white tracking-tight">Call History & Logs</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Review voice recordings, speaker transcripts, and tool waterfalls.
        </p>
      </div>

      <EmptyState
        icon={PhoneCall}
        title="No Calls Recorded Yet"
        description="Once telephony is connected in Phase 3 and your AI receptionist answers calls, transcripts, audio recordings, and post-call analytics will be logged here."
        badge="Coming in Phase 3"
      />
    </div>
  );
}
