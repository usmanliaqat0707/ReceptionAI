import { prisma } from "@receptionai/db";
import { getCurrentUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { Contact, Phone, Mail, Calendar, UserCheck } from "lucide-react";

export default async function ContactsPage() {
  const user = await getCurrentUser();
  const workspaceId = user?.workspaceId || "ws_bright_dental";

  const contacts = await prisma.contact.findMany({
    where: { workspaceId },
    include: {
      _count: {
        select: { appointments: true, leads: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">Customer & Patient Directory</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Contacts created and updated automatically from telephone receptionist interactions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            {contacts.length} Total Contacts
          </span>
        </div>
      </div>

      {/* Directory Table */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden glass-panel">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] text-slate-400 uppercase border-b border-slate-800/80 bg-slate-950/60">
              <tr>
                <th className="py-3 px-4">Patient / Customer Name</th>
                <th className="py-3 px-4">Phone Number</th>
                <th className="py-3 px-4">Email Address</th>
                <th className="py-3 px-4">Source</th>
                <th className="py-3 px-4">Bookings</th>
                <th className="py-3 px-4 text-right">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {contacts.map((c) => (
                <tr key={c.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-200">
                      {c.firstName} {c.lastName || ""}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-indigo-300">
                    {c.phone}
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    {c.email || "—"}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                      {c.source.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-emerald-400 font-semibold">{c._count.appointments} appointments</span>
                  </td>
                  <td className="py-3 px-4 text-right text-slate-400 text-[11px]">
                    {formatDateTime(c.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
