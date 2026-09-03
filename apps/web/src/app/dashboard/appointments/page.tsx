import { prisma } from "@receptionai/db";
import { getCurrentUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { CalendarDays, Clock, CheckCircle2, User, Phone, Bot, ArrowUpRight } from "lucide-react";
import Link from "next/link";

export default async function AppointmentsPage() {
  const user = await getCurrentUser();
  const workspaceId = user?.workspaceId || "ws_bright_dental";

  const appointments = await prisma.appointment.findMany({
    where: { workspaceId },
    include: {
      contact: true,
      service: true,
      receptionist: { select: { name: true } },
      call: { select: { id: true, durationSeconds: true } },
    },
    orderBy: { startAt: "asc" },
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">Appointments & Calendar</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Confirmed clinic bookings made through natural conversation with Ava.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{appointments.length} Confirmed Slots</span>
          </span>
        </div>
      </div>

      {/* Appointments Grid / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {appointments.map((apt) => {
          const patientName = `${apt.contact.firstName} ${apt.contact.lastName || ""}`;
          return (
            <div
              key={apt.id}
              className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500/40 transition glass-panel space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-mono text-indigo-400 font-semibold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDateTime(apt.startAt)}
                  </div>
                  <h3 className="text-base font-bold text-white mt-1">{apt.service?.name || "Dental Service"}</h3>
                </div>

                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase">
                  {apt.status}
                </span>
              </div>

              {/* Patient details */}
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Patient:</span>
                  <span className="font-semibold text-slate-200">{patientName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Phone:</span>
                  <span className="font-mono text-indigo-300">{apt.contact.phone}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Booked By:</span>
                  <span className="font-medium text-slate-300 flex items-center gap-1">
                    <Bot className="w-3 h-3 text-indigo-400" />
                    {apt.receptionist?.name || "Ava"}
                  </span>
                </div>
              </div>

              {/* Notes */}
              {apt.notes && (
                <div className="text-[11px] text-slate-400 bg-slate-800/40 p-2.5 rounded-lg border border-slate-800">
                  {apt.notes}
                </div>
              )}

              {/* Footer */}
              {apt.call && (
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-slate-500">Originating Call</span>
                  <Link
                    href={`/dashboard/calls/${apt.call.id}`}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                  >
                    Inspect Call #{apt.call.id.slice(-6)} <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
