"use client";

import React from "react";
import { Target } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export default function LeadsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-base font-bold text-white tracking-tight">Leads & Inquiries</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          High-intent inquiries qualified and extracted by your AI receptionist.
        </p>
      </div>

      <EmptyState
        icon={Target}
        title="No Leads Captured Yet"
        description="Prospective clients requesting quotes, service information, or consultations during phone interactions will be triaged here."
        badge="Coming in Phase 3"
      />
    </div>
  );
}
