"use client";

import React from "react";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export default function ContactsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-base font-bold text-white tracking-tight">Contacts Directory</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Unified caller address book, interaction histories, and identity records.
        </p>
      </div>

      <EmptyState
        icon={Users}
        title="No Contacts Created Yet"
        description="Callers recognized across inbound phone calls will be automatically aggregated into contacts with full caller timelines."
        badge="Coming in Phase 3"
      />
    </div>
  );
}
