"use client";

import Link from "next/link";
import { Mic, Bell, PhoneForwarded, Radio, Search } from "lucide-react";
import { useState } from "react";

export function Header({ title = "Dashboard" }: { title?: string }) {
  const [showNotifications, setShowNotifications] = useState(false);

  const notifications = [
    { title: "Appointment Confirmed", desc: "John Smith scheduled Dental Cleaning tomorrow 3:30 PM", time: "10m ago" },
    { title: "New Qualified Lead", desc: "Sarah Connor requested Teeth Whitening consultation", time: "34m ago" },
    { title: "Call Transferred", desc: "Emergency toothache forwarded to Dr. Vance triage line", time: "1h ago" },
  ];

  return (
    <header className="h-16 border-b border-slate-800/80 bg-[#0d1322]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Title & Status */}
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-bold text-white tracking-tight">{title}</h1>
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-slate-400">Gateway:</span>
          <span className="text-emerald-400 font-medium">Ready (WebRTC / SIP)</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/playground"
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition border border-indigo-400/30 glow-primary"
        >
          <Mic className="w-3.5 h-3.5 animate-pulse" />
          <span>Launch Voice Playground</span>
        </Link>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="w-9 h-9 rounded-lg bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-slate-300 hover:text-white transition relative"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-indigo-500" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-3 space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Live Event Notifications</span>
                <span className="text-[10px] text-indigo-400 font-medium">3 unread</span>
              </div>
              <div className="space-y-2">
                {notifications.map((n, i) => (
                  <div key={i} className="p-2 rounded-lg bg-slate-800/60 border border-slate-800 text-xs">
                    <div className="font-semibold text-slate-200">{n.title}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{n.desc}</div>
                    <div className="text-[9px] text-slate-500 mt-1">{n.time}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
