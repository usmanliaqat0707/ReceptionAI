"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  History,
  FileText,
  CalendarCheck,
  ExternalLink,
  Send,
  MessageSquare,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface AppointmentDetail {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  timezone: string;
  status: "CONFIRMED" | "RESCHEDULED" | "CANCELLED" | "COMPLETED";
  notes: string | null;
  source: string;
  externalEventId: string | null;
  contact: {
    id: string;
    firstName: string;
    lastName: string | null;
    phone: string | null;
    email: string | null;
  };
  service: {
    id: string;
    name: string;
    durationMinutes: number;
    priceText: string | null;
  };
  calendarIntegration: {
    id: string;
    name: string;
    provider: string;
  };
  changes: Array<{
    id: string;
    type: string;
    createdAt: string;
    actorType: string;
    oldStartAt: string | null;
    newStartAt: string | null;
    notes: string | null;
  }>;
  communications?: Array<{
    id: string;
    channel: "SMS" | "EMAIL";
    purpose: string;
    recipientAddress: string;
    status: string;
    sentAt?: string | null;
    deliveredAt?: string | null;
    createdAt: string;
  }>;
}

export default function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [appointment, setAppointment] = useState<AppointmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  // Reschedule Modal
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [checkingSlots, setCheckingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [submittingReschedule, setSubmittingReschedule] = useState(false);

  // Cancel Modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [submittingCancel, setSubmittingCancel] = useState(false);

  useEffect(() => {
    apiFetch<{ memberships: Array<{ workspace: { id: string; slug: string } }> }>(
      "/api/v1/auth/me"
    )
      .then((data) => {
        const storedSlug = localStorage.getItem("rai_active_ws");
        const match =
          data.memberships.find((m) => m.workspace.slug === storedSlug) ||
          data.memberships[0];
        if (match) setWorkspaceId(match.workspace.id);
      })
      .catch(() => {});
  }, []);

  const fetchAppointment = useCallback(async () => {
    if (!workspaceId || !id) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ data: AppointmentDetail }>(
        `/api/v1/workspaces/${workspaceId}/appointments/${id}`
      );
      setAppointment(res.data);
    } catch (err: any) {
      setActionError(err.message || "Failed to load appointment details.");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, id]);

  useEffect(() => {
    fetchAppointment();
  }, [fetchAppointment]);

  // Check slots when rescheduling
  useEffect(() => {
    if (showRescheduleModal && workspaceId && appointment?.service?.id && rescheduleDate) {
      setCheckingSlots(true);
      setSelectedSlot(null);
      apiFetch<{ data: { slots: any[] } }>(
        `/api/v1/workspaces/${workspaceId}/availability?serviceId=${appointment.service.id}&date=${rescheduleDate}`
      )
        .then((res) => setAvailableSlots(res.data?.slots || []))
        .catch(() => setAvailableSlots([]))
        .finally(() => setCheckingSlots(false));
    }
  }, [showRescheduleModal, workspaceId, appointment, rescheduleDate]);

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !id || !selectedSlot) return;

    setSubmittingReschedule(true);
    setActionError(null);

    try {
      await apiFetch(
        `/api/v1/workspaces/${workspaceId}/appointments/${id}/reschedule`,
        {
          method: "PATCH",
          body: JSON.stringify({
            startAt: selectedSlot.startAt,
            reason: rescheduleReason || undefined,
          }),
        }
      );

      setShowRescheduleModal(false);
      fetchAppointment();
    } catch (err: any) {
      setActionError(err.message || "Failed to reschedule appointment.");
    } finally {
      setSubmittingReschedule(false);
    }
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !id) return;

    setSubmittingCancel(true);
    setActionError(null);

    try {
      await apiFetch(
        `/api/v1/workspaces/${workspaceId}/appointments/${id}/cancel`,
        {
          method: "POST",
          body: JSON.stringify({
            reason: cancelReason || undefined,
          }),
        }
      );

      setShowCancelModal(false);
      fetchAppointment();
    } catch (err: any) {
      setActionError(err.message || "Failed to cancel appointment.");
    } finally {
      setSubmittingCancel(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
        <span className="text-xs">Loading appointment details...</span>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="space-y-4">
        <Link
          href="/appointments"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Appointments
        </Link>
        <div className="p-6 rounded-xl border border-slate-800 bg-slate-900 text-center text-slate-400">
          <p className="text-sm font-semibold text-white">Appointment Not Found</p>
          <p className="text-xs mt-1">This appointment may have been deleted or archived.</p>
        </div>
      </div>
    );
  }

  const startDate = new Date(appointment.startAt);
  const endDate = new Date(appointment.endAt);
  const contactName = `${appointment.contact?.firstName || ""} ${
    appointment.contact?.lastName || ""
  }`.trim();

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Top Nav */}
      <div className="flex items-center justify-between">
        <Link
          href="/appointments"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Appointments
        </Link>

        {appointment.status !== "CANCELLED" && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRescheduleModal(true)}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition"
            >
              Reschedule
            </button>
            <button
              onClick={() => setShowCancelModal(true)}
              className="px-3 py-1.5 text-xs font-semibold text-rose-300 bg-rose-950/60 hover:bg-rose-900/80 rounded-lg border border-rose-800/80 transition"
            >
              Cancel Appointment
            </button>
          </div>
        )}
      </div>

      {actionError && (
        <div className="p-3 bg-rose-950/70 border border-rose-800/80 rounded-lg text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Main Card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-6 shadow">
        <div className="flex items-start justify-between border-b border-slate-800/80 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold text-white tracking-tight">
                {appointment.title}
              </h1>
              {appointment.status === "CONFIRMED" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                  <CheckCircle2 className="w-3 h-3" /> Confirmed
                </span>
              )}
              {appointment.status === "RESCHEDULED" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-950/80 text-amber-400 border border-amber-800/60">
                  <Clock className="w-3 h-3" /> Rescheduled
                </span>
              )}
              {appointment.status === "CANCELLED" && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-950/80 text-rose-400 border border-rose-800/60">
                  <XCircle className="w-3 h-3" /> Cancelled
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Source: {appointment.source === "VOICE_RECEPTIONIST" ? "AI Voice Receptionist (Ava)" : "Manual Staff Booking"}
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs font-semibold text-indigo-400">
              {appointment.service?.durationMinutes || 30} mins
            </span>
            {appointment.service?.priceText && (
              <p className="text-xs text-slate-400">{appointment.service.priceText}</p>
            )}
          </div>
        </div>

        {/* 2-Column Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Scheduling Details */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" /> Appointment Time & Date
            </h2>
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3.5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Date</span>
                <span className="font-semibold text-white">
                  {startDate.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Time Window</span>
                <span className="font-semibold text-white">
                  {startDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} -{" "}
                  {endDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Timezone</span>
                <span className="text-slate-300">{appointment.timezone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Calendar Integration</span>
                <span className="text-slate-300">
                  {appointment.calendarIntegration?.name} (
                  {appointment.calendarIntegration?.provider === "GOOGLE_CALENDAR"
                    ? "Google Calendar"
                    : "Internal Demo"}
                  )
                </span>
              </div>
              {appointment.externalEventId && (
                <div className="flex justify-between">
                  <span className="text-slate-400">External Event ID</span>
                  <span className="font-mono text-[11px] text-slate-400">
                    {appointment.externalEventId}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Contact Details */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-400" /> Caller / Client
            </h2>
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3.5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Name</span>
                <span className="font-semibold text-white">{contactName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Phone</span>
                <span className="text-slate-300">
                  {appointment.contact?.phone || "Not recorded"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Email</span>
                <span className="text-slate-300">
                  {appointment.contact?.email || "Not recorded"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        {appointment.notes && (
          <div className="space-y-2">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-400" /> Booking Notes
            </h2>
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 whitespace-pre-wrap">
              {appointment.notes}
            </div>
          </div>
        )}

        {/* Change History Timeline */}
        <div className="space-y-3 pt-2">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-indigo-400" /> Lifecycle & Mutation History
          </h2>
          <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg bg-slate-950/50">
            {appointment.changes.length === 0 ? (
              <div className="p-3 text-xs text-slate-500">No previous changes recorded.</div>
            ) : (
              appointment.changes.map((ch) => (
                <div key={ch.id} className="p-3 flex items-start justify-between text-xs">
                  <div>
                    <span className="font-semibold text-white">{ch.type}</span>
                    <span className="text-slate-500 ml-2">by {ch.actorType}</span>
                    {ch.notes && <p className="text-slate-400 mt-0.5">{ch.notes}</p>}
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {new Date(ch.createdAt).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Outbound Confirmation Notifications */}
        <div className="space-y-3 pt-2">
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5 text-indigo-400" /> Outbound Confirmations & Delivery Status
          </h2>
          <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg bg-slate-950/50">
            {!appointment.communications || appointment.communications.length === 0 ? (
              <div className="p-3 text-xs text-slate-500">No outbound notifications dispatched yet.</div>
            ) : (
              appointment.communications.map((c) => (
                <div key={c.id} className="p-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    {c.channel === "SMS" ? (
                      <span className="p-1 rounded bg-sky-950/70 text-sky-400 border border-sky-800">
                        <MessageSquare className="h-3.5 w-3.5" />
                      </span>
                    ) : (
                      <span className="p-1 rounded bg-indigo-950/70 text-indigo-400 border border-indigo-800">
                        <Mail className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <div>
                      <span className="font-semibold text-white">{c.channel}</span>
                      <span className="text-slate-400 font-mono ml-2">{c.recipientAddress}</span>
                      <span className="text-slate-500 ml-2 text-[11px]">({c.purpose})</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        c.status === "DELIVERED"
                          ? "bg-emerald-950/80 text-emerald-400 border-emerald-800"
                          : c.status === "SENT"
                          ? "bg-blue-950/80 text-blue-400 border-blue-800"
                          : c.status === "FAILED"
                          ? "bg-rose-950/80 text-rose-400 border-rose-800"
                          : "bg-amber-950/80 text-amber-400 border-amber-800"
                      }`}
                    >
                      {c.status}
                    </span>
                    <Link
                      href={`/communications/${c.id}`}
                      className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      Inspect &rarr;
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Reschedule Modal */}
      {showRescheduleModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" /> Reschedule Appointment
              </h2>
              <button
                onClick={() => setShowRescheduleModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRescheduleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Select New Date
                </label>
                <input
                  type="date"
                  value={rescheduleDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Select Open Slot
                </label>
                {checkingSlots ? (
                  <div className="flex items-center gap-2 p-3 text-xs text-slate-400 bg-slate-950 rounded-lg border border-slate-800">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                    Checking open availability...
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="p-3 text-xs text-amber-400 bg-amber-950/40 rounded-lg border border-amber-900/50">
                    No slots available on this date.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {availableSlots.map((slot) => {
                      const isSelected = selectedSlot?.slotId === slot.slotId;
                      return (
                        <button
                          type="button"
                          key={slot.slotId}
                          onClick={() => setSelectedSlot(slot)}
                          className={`p-2 text-xs rounded-lg border text-left transition font-medium ${
                            isSelected
                              ? "bg-indigo-600 text-white border-indigo-400 shadow"
                              : "bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          {slot.formattedTime}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Reschedule Reason
                </label>
                <input
                  type="text"
                  placeholder="Caller requested different time..."
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRescheduleModal(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReschedule || !selectedSlot}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 disabled:opacity-50 transition"
                >
                  {submittingReschedule ? "Updating..." : "Confirm Reschedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <XCircle className="w-4 h-4 text-rose-400" /> Cancel Appointment
              </h2>
              <button
                onClick={() => setShowCancelModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to cancel this appointment for{" "}
              <strong className="text-white">{contactName}</strong> on{" "}
              <strong className="text-white">
                {startDate.toLocaleDateString()} at {startDate.toLocaleTimeString()}
              </strong>
              ? This action will free the slot on the calendar.
            </p>

            <form onSubmit={handleCancelSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Cancellation Reason
                </label>
                <input
                  type="text"
                  placeholder="Caller cancelled visit..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white transition"
                >
                  Keep Appointment
                </button>
                <button
                  type="submit"
                  disabled={submittingCancel}
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-500 disabled:opacity-50 transition"
                >
                  {submittingCancel ? "Cancelling..." : "Yes, Cancel Booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
