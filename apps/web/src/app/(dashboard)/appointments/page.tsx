"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Appointment {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  status: "CONFIRMED" | "RESCHEDULED" | "CANCELLED" | "COMPLETED";
  source: string;
  contact?: {
    id: string;
    firstName: string;
    lastName: string | null;
    phone: string | null;
    email: string | null;
  };
  service?: {
    id: string;
    name: string;
    durationMinutes: number;
    priceText: string | null;
  };
  calendarIntegration?: {
    id: string;
    name: string;
    provider: string;
  };
}

interface Service {
  id: string;
  name: string;
  durationMinutes: number;
}

interface Contact {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
}

export default function AppointmentsPage() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Booking Modal State
  const [showBookModal, setShowBookModal] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [bookingDate, setBookingDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [checkingSlots, setCheckingSlots] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [bookingNotes, setBookingNotes] = useState("");
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Load Active Workspace
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

  const fetchAppointments = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (filterStatus !== "ALL") queryParams.set("status", filterStatus);
      const res = await apiFetch<{ data: Appointment[] }>(
        `/api/v1/workspaces/${workspaceId}/appointments?${queryParams.toString()}`
      );
      setAppointments(res.data || []);
    } catch (err) {
      console.error("Failed to load appointments:", err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, filterStatus]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Load services and contacts when opening modal
  useEffect(() => {
    if (showBookModal && workspaceId) {
      apiFetch<{ data: Service[] }>(`/api/v1/workspaces/${workspaceId}/services`)
        .then((res) => {
          setServices(res.data || []);
          if (res.data?.[0]) setSelectedServiceId(res.data[0].id);
        })
        .catch(() => {});

      apiFetch<{ data: Contact[] }>(`/api/v1/workspaces/${workspaceId}/contacts`)
        .then((res) => {
          setContacts(res.data || []);
          if (res.data?.[0]) setSelectedContactId(res.data[0].id);
        })
        .catch(() => {});
    }
  }, [showBookModal, workspaceId]);

  // Check available slots when service or date changes
  useEffect(() => {
    if (showBookModal && workspaceId && selectedServiceId && bookingDate) {
      setCheckingSlots(true);
      setSelectedSlotId("");
      apiFetch<{ data: { slots: any[] } }>(
        `/api/v1/workspaces/${workspaceId}/availability?serviceId=${selectedServiceId}&date=${bookingDate}`
      )
        .then((res) => {
          setAvailableSlots(res.data?.slots || []);
        })
        .catch(() => setAvailableSlots([]))
        .finally(() => setCheckingSlots(false));
    }
  }, [showBookModal, workspaceId, selectedServiceId, bookingDate]);

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !selectedContactId || !selectedServiceId || !selectedSlotId) {
      setModalError("Please select a contact, service, and time slot.");
      return;
    }

    setBookingSubmitting(true);
    setModalError(null);

    try {
      const slot = availableSlots.find((s) => s.slotId === selectedSlotId);
      await apiFetch(`/api/v1/workspaces/${workspaceId}/appointments`, {
        method: "POST",
        body: JSON.stringify({
          contactId: selectedContactId,
          serviceId: selectedServiceId,
          startAt: slot ? slot.startAt : new Date().toISOString(),
          notes: bookingNotes || undefined,
        }),
      });

      setShowBookModal(false);
      fetchAppointments();
    } catch (err: any) {
      setModalError(err.message || "Failed to book appointment.");
    } finally {
      setBookingSubmitting(false);
    }
  };

  const filteredAppointments = appointments.filter((appt) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const contactName = `${appt.contact?.firstName || ""} ${appt.contact?.lastName || ""}`.toLowerCase();
    const serviceName = (appt.service?.name || "").toLowerCase();
    const phone = (appt.contact?.phone || "").toLowerCase();
    return contactName.includes(q) || serviceName.includes(q) || phone.includes(q);
  });

  const getStatusBadge = (status: Appointment["status"]) => {
    switch (status) {
      case "CONFIRMED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
            <CheckCircle2 className="w-3 h-3" /> Confirmed
          </span>
        );
      case "RESCHEDULED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-950/80 text-amber-400 border border-amber-800/60">
            <Clock className="w-3 h-3" /> Rescheduled
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-950/80 text-rose-400 border border-rose-800/60">
            <XCircle className="w-3 h-3" /> Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-indigo-400" />
            Appointments Schedule
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic calendar reservations verified and executed through the trusted Tool Gateway.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchAppointments()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 bg-slate-900 border border-slate-800 rounded-lg hover:border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowBookModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition shadow"
          >
            <Plus className="w-4 h-4" />
            New Appointment
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/70 border border-slate-800">
        <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-lg border border-slate-800/80 text-xs">
          {["ALL", "CONFIRMED", "RESCHEDULED", "CANCELLED"].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1 rounded-md transition font-medium ${
                filterStatus === st
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {st === "ALL" ? "All Bookings" : st.charAt(0) + st.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by caller, service, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>
      </div>

      {/* Appointments List */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
          <span className="text-xs">Loading appointments...</span>
        </div>
      ) : filteredAppointments.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-center p-6 rounded-xl border border-dashed border-slate-800 bg-slate-900/30">
          <CalendarDays className="w-12 h-12 text-slate-600 mb-3" />
          <h3 className="text-sm font-semibold text-white">No Appointments Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">
            {filterStatus !== "ALL"
              ? `No ${filterStatus.toLowerCase()} appointments match your criteria.`
              : "No appointments have been booked yet. Let your AI receptionist book appointments via voice or book manually."}
          </p>
          <button
            onClick={() => setShowBookModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition"
          >
            <Plus className="w-3.5 h-3.5" /> Book First Appointment
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Caller / Contact</th>
                <th className="py-3 px-4">Service</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Calendar</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredAppointments.map((appt) => {
                const startDate = new Date(appt.startAt);
                const endDate = new Date(appt.endAt);
                const contactName = appt.contact
                  ? `${appt.contact.firstName} ${appt.contact.lastName || ""}`.trim()
                  : "Unknown Contact";

                return (
                  <tr key={appt.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-white font-semibold text-[10px]">
                          {contactName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-white">{contactName}</p>
                          <p className="text-[11px] text-slate-400">
                            {appt.contact?.phone || appt.contact?.email || "No phone"}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-200">
                        {appt.service?.name || "Standard Service"}
                      </p>
                      {appt.service?.priceText && (
                        <p className="text-[10px] text-slate-400">{appt.service.priceText}</p>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <p className="font-semibold text-white">
                        {startDate.toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {startDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} -{" "}
                        {endDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </p>
                    </td>

                    <td className="py-3 px-4">
                      <span className="text-slate-300 font-medium">
                        {appt.service?.durationMinutes || 30} mins
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                        {appt.calendarIntegration?.provider === "GOOGLE_CALENDAR"
                          ? "Google Calendar"
                          : "Internal Demo"}
                      </span>
                    </td>

                    <td className="py-3 px-4">{getStatusBadge(appt.status)}</td>

                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`/appointments/${appt.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-medium transition"
                      >
                        Details <ExternalLink className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Manual Booking Modal */}
      {showBookModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" /> Book New Appointment
              </h2>
              <button
                onClick={() => setShowBookModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-950/70 border border-rose-800/80 rounded-lg text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleBookSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Select Contact
                </label>
                <select
                  value={selectedContactId}
                  onChange={(e) => setSelectedContactId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  required
                >
                  <option value="">-- Choose Contact --</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.firstName} {c.lastName || ""} ({c.phone || "No phone"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Select Service
                </label>
                <select
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  required
                >
                  <option value="">-- Choose Service --</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.durationMinutes} mins)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Appointment Date
                </label>
                <input
                  type="date"
                  value={bookingDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Available Slots
                </label>
                {checkingSlots ? (
                  <div className="flex items-center gap-2 p-3 text-xs text-slate-400 bg-slate-950/60 rounded-lg border border-slate-800">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                    Checking authoritative calendar availability...
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="p-3 text-xs text-amber-400 bg-amber-950/40 rounded-lg border border-amber-900/50">
                    No available open slots on this date. Try another date or check business hours.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                    {availableSlots.map((slot) => {
                      const isSelected = selectedSlotId === slot.slotId;
                      return (
                        <button
                          type="button"
                          key={slot.slotId}
                          onClick={() => setSelectedSlotId(slot.slotId)}
                          className={`p-2 text-xs rounded-lg border text-left transition font-medium ${
                            isSelected
                              ? "bg-indigo-600 text-white border-indigo-400 shadow"
                              : "bg-slate-950/80 text-slate-300 border-slate-800 hover:border-slate-700"
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
                  Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Reason for visit or special caller requests..."
                  value={bookingNotes}
                  onChange={(e) => setBookingNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBookModal(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bookingSubmitting || !selectedSlotId}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 disabled:opacity-50 transition"
                >
                  {bookingSubmitting ? "Booking..." : "Confirm & Book"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
