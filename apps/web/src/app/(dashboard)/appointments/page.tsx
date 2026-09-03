"use client";

import React from "react";
import { Calendar } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export default function AppointmentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-base font-bold text-white tracking-tight">Appointments Schedule</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Calendar reservations and confirmed bookings scheduled by your receptionist.
        </p>
      </div>

      <EmptyState
        icon={Calendar}
        title="No Bookings Scheduled Yet"
        description="Appointments booked by your receptionist using deterministic slot availability checks will populate this calendar."
        badge="Coming in Phase 3"
      />
    </div>
  );
}
