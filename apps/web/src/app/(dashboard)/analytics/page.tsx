"use client";

import React from "react";
import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-base font-bold text-white tracking-tight">Telemetry & Analytics</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Realtime speech latency metrics, call conversion funnels, and intent volume trends.
        </p>
      </div>

      <EmptyState
        icon={BarChart3}
        title="No Telemetry Data Accumulated"
        description="Production analytics reflecting live call traffic, turn-taking speech latency, and call outcomes will stream here once voice calls are active."
        badge="Coming in Phase 3"
      />
    </div>
  );
}
