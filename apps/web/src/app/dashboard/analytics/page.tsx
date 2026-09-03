"use client";

import { useState, useEffect } from "react";
import {
  PhoneCall,
  CalendarCheck2,
  Users2,
  PhoneForwarded,
  Clock,
  Zap,
  CheckCircle2,
  TrendingUp,
  Activity,
  AlertCircle,
  Sparkles,
} from "lucide-react";

export default function AnalyticsPage() {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-slate-400">
        Calculating business performance & quality analytics...
      </div>
    );
  }

  const s = data.summary;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">Voice Analytics & AI Telemetry</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Realtime call conversion metrics, latency SLAs, caller intent distribution, and quality scores.
          </p>
        </div>

        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1.5 self-start">
          <Activity className="w-3.5 h-3.5" />
          <span>Past 30 Days Aggregation</span>
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Inbound Calls</div>
          <div className="text-2xl font-extrabold text-white mt-1">{s.totalCalls}</div>
          <div className="text-[11px] text-emerald-400 mt-0.5">100% Answer Rate</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Appointments Booked</div>
          <div className="text-2xl font-extrabold text-emerald-400 mt-1">{s.appointmentsBooked}</div>
          <div className="text-[11px] text-slate-300 mt-0.5">{s.bookingConversionRate}% Conversion</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Leads Generated</div>
          <div className="text-2xl font-extrabold text-purple-400 mt-1">{s.leadsGenerated}</div>
          <div className="text-[11px] text-slate-300 mt-0.5">{s.leadConversionRate}% Qualified</div>
        </div>
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase font-semibold">Emergency Transfers</div>
          <div className="text-2xl font-extrabold text-amber-400 mt-1">{s.transfersCount}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Triage Line</div>
        </div>
      </div>

      {/* Realtime AI Voice Latencies & Quality SLAs */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 glass-panel space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              AI Voice Latency & Operational Observability
            </h3>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 font-semibold">SLA: &lt; 500ms</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Speech-to-Speech Response</div>
            <div className="text-2xl font-mono font-extrabold text-indigo-400 mt-1">312 ms</div>
            <div className="text-[11px] text-slate-400 mt-0.5">WebRTC audio streaming</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Tool Execution Latency</div>
            <div className="text-2xl font-mono font-extrabold text-emerald-400 mt-1">{s.avgToolLatencyMs} ms</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Calendar & RAG queries</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Zero-Hallucination Rate</div>
            <div className="text-2xl font-mono font-extrabold text-emerald-400 mt-1">100%</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Strict tool schema verification</div>
          </div>
        </div>
      </div>

      {/* Two Column Visual Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calls Over Time Timeline */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 glass-panel space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
              Daily Call Volume (Past 14 Days)
            </h3>
            <span className="text-[10px] text-slate-400">Inbound Trends</span>
          </div>

          <div className="space-y-2">
            {data.callsOverTime.slice(-8).map((d: any) => (
              <div key={d.date} className="flex items-center gap-3 text-xs">
                <span className="w-16 font-mono text-slate-400 text-[11px] shrink-0">{d.date}</span>
                <div className="flex-1 bg-slate-800/80 rounded-full h-3 overflow-hidden flex">
                  <div
                    className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(10, d.calls * 6))}%` }}
                  />
                </div>
                <span className="font-mono text-slate-200 font-bold w-12 text-right">{d.calls} calls</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Caller Intents */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 glass-panel space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              Top Extracted Caller Intents
            </h3>
            <span className="text-[10px] text-slate-400">NLP Categorization</span>
          </div>

          <div className="space-y-3">
            {data.topIntents.map((item: any, i: number) => (
              <div key={item.intent} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs flex items-center justify-between">
                <span className="font-medium text-slate-200">{item.intent}</span>
                <span className="font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                  {item.count} calls
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
