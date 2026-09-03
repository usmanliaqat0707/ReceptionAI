"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Mic,
  MicOff,
  PhoneOff,
  Play,
  RotateCcw,
  Sparkles,
  Zap,
  CheckCircle2,
  Clock,
  Send,
  Bot,
  User,
  ExternalLink,
  ChevronRight,
  Database,
  Radio,
  Sliders,
} from "lucide-react";

interface TranscriptMessage {
  id: string;
  role: "caller" | "assistant" | "system";
  text: string;
  time: string;
}

interface AgentEvent {
  id: string;
  type: "tool_call" | "knowledge_retrieval" | "latency" | "state_change";
  name: string;
  durationMs: number;
  input?: any;
  output?: any;
  time: string;
}

const SCENARIOS = [
  {
    title: "Book Dental Cleaning Tomorrow",
    desc: "Test calendar availability query & appointment booking",
    callerFirstText: "Hi Ava, I'd like to book an appointment for a dental cleaning tomorrow afternoon.",
  },
  {
    title: "Insurance & Pricing Inquiry",
    desc: "Test RAG knowledge retrieval for insurance & fee schedule",
    callerFirstText: "Do you accept Delta Dental insurance and how much is a routine cleaning?",
  },
  {
    title: "Severe Toothache Emergency",
    desc: "Test emergency triage and doctor transfer protocol",
    callerFirstText: "I'm having severe tooth pain and swelling on my lower jaw, is Dr. Vance available?",
  },
  {
    title: "Leave Callback Message",
    desc: "Test message taking tool with callback urgency",
    callerFirstText: "Could I leave a message for the office manager regarding a billing question?",
  },
];

export default function PlaygroundPage() {
  const [callActive, setCallActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [selectedScenario, setSelectedScenario] = useState(SCENARIOS[0]);
  const [completedSummary, setCompletedSummary] = useState<any | null>(null);
  const [receptionistId, setReceptionistId] = useState("");

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const eventsBottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat and events
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    eventsBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  // Load Ava receptionist ID on mount
  useEffect(() => {
    fetch("/api/receptionists")
      .then((res) => res.json())
      .then((data) => {
        if (data.receptionists && data.receptionists.length > 0) {
          setReceptionistId(data.receptionists[0].id);
        }
      })
      .catch(console.error);
  }, []);

  // Start Call Session
  const handleStartCall = async (initialQuery?: string) => {
    setCompletedSummary(null);
    setMessages([]);
    setEvents([]);

    try {
      // 1. Create Call Record in Database
      const callRes = await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receptionistId,
          callerName: "Interactive Tester",
          callerNumber: "+1 (541) 555-0199",
        }),
      });
      const callData = await callRes.json();
      const callId = callData.call?.id;
      setCurrentCallId(callId);

      setCallActive(true);
      setIsSpeaking(true);

      // Ava Initial Greeting
      const greetingText = "Thank you for calling Bright Dental. This is Ava. How may I help you today?";
      const initialMsgs: TranscriptMessage[] = [
        {
          id: `msg_0`,
          role: "assistant",
          text: greetingText,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ];
      setMessages(initialMsgs);

      // Add system initialization event
      setEvents([
        {
          id: "evt_init",
          type: "state_change",
          name: "Session Connected (WebRTC / Voice Simulator)",
          durationMs: 48,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        },
      ]);

      // If initial query supplied from scenario
      if (initialQuery) {
        setTimeout(() => {
          sendCallerMessage(initialQuery, callId);
        }, 1200);
      }
    } catch (err) {
      console.error("Failed to start call:", err);
    } finally {
      setTimeout(() => setIsSpeaking(false), 2000);
    }
  };

  // Send Caller Message
  const sendCallerMessage = async (text: string, callIdParam?: string) => {
    if (!text.trim()) return;
    const callId = callIdParam || currentCallId;

    const callerMsg: TranscriptMessage = {
      id: `msg_${Date.now()}`,
      role: "caller",
      text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, callerMsg]);
    setInputMessage("");
    setIsSpeaking(true);

    const lower = text.toLowerCase();

    // Determine appropriate tool to invoke based on caller input
    setTimeout(async () => {
      if (lower.includes("appointment") || lower.includes("cleaning") || lower.includes("book")) {
        // Step 1: Tool check_availability
        const startT = Date.now();
        const toolRes = await fetch("/api/tools/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toolName: "check_availability",
            parameters: { service: "Dental Cleaning", datePreference: "tomorrow afternoon" },
            callId,
          }),
        });
        const toolData = await toolRes.json();
        const dur = Date.now() - startT;

        setEvents((prev) => [
          ...prev,
          {
            id: `evt_${Date.now()}`,
            type: "tool_call",
            name: "check_availability",
            durationMs: dur || 220,
            input: { service: "Dental Cleaning", datePreference: "tomorrow afternoon" },
            output: toolData.data,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          },
        ]);

        // Ava responds with available slots
        setTimeout(() => {
          const replyText = "I checked our schedule with Dr. Vance for tomorrow afternoon. We have openings at 1:30 PM and 3:00 PM. Which of those times works best for you?";
          setMessages((prev) => [
            ...prev,
            {
              id: `msg_${Date.now()}`,
              role: "assistant",
              text: replyText,
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
          setIsSpeaking(false);
        }, 600);
      } else if (lower.includes("3") || lower.includes("three") || lower.includes("1:30") || lower.includes("works") || lower.includes("yes")) {
        // Step 2: Tool book_appointment
        const startT = Date.now();
        const toolRes = await fetch("/api/tools/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toolName: "book_appointment",
            parameters: {
              callerName: "Interactive Tester",
              callerPhone: "+1 (541) 555-0199",
              serviceName: "Dental Cleaning",
              slotTime: "3:00 PM",
              callerConfirmed: true,
            },
            callId,
          }),
        });
        const toolData = await toolRes.json();
        const dur = Date.now() - startT;

        setEvents((prev) => [
          ...prev,
          {
            id: `evt_${Date.now()}`,
            type: "tool_call",
            name: "book_appointment",
            durationMs: dur || 190,
            input: { service: "Dental Cleaning", slot: "3:00 PM", confirmed: true },
            output: toolData.data,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          },
        ]);

        setTimeout(() => {
          const replyText = "You're all set! I have confirmed your Dental Cleaning for tomorrow at 3:00 PM with Dr. Vance. We have sent a confirmation text to your mobile number. Is there anything else I can help with?";
          setMessages((prev) => [
            ...prev,
            {
              id: `msg_${Date.now()}`,
              role: "assistant",
              text: replyText,
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
          setIsSpeaking(false);
        }, 500);
      } else if (lower.includes("insurance") || lower.includes("price") || lower.includes("cost") || lower.includes("delta")) {
        // Step 3: Tool search_knowledge_base (RAG)
        const startT = Date.now();
        const toolRes = await fetch("/api/tools/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toolName: "search_knowledge_base",
            parameters: { query: text },
            callId,
          }),
        });
        const toolData = await toolRes.json();
        const dur = Date.now() - startT;

        setEvents((prev) => [
          ...prev,
          {
            id: `evt_${Date.now()}`,
            type: "knowledge_retrieval",
            name: "search_knowledge_base (pgvector RAG)",
            durationMs: dur || 165,
            input: { query: text },
            output: toolData.data?.results?.[0]?.content || "In-network with Delta Dental Premier & PPO.",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          },
        ]);

        setTimeout(() => {
          const replyText = "Yes! Bright Dental is in-network with Delta Dental Premier & PPO, MetLife, Cigna, and Guardian. Our routine preventive cleaning is $120, which is typically covered 100% by preventive insurance plans.";
          setMessages((prev) => [
            ...prev,
            {
              id: `msg_${Date.now()}`,
              role: "assistant",
              text: replyText,
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
          setIsSpeaking(false);
        }, 500);
      } else if (lower.includes("pain") || lower.includes("emergency") || lower.includes("swelling") || lower.includes("hurt")) {
        // Step 4: Tool transfer_call
        const startT = Date.now();
        const toolRes = await fetch("/api/tools/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toolName: "transfer_call",
            parameters: { destination: "emergency_doctor", reason: "Severe tooth pain and swelling" },
            callId,
          }),
        });
        const toolData = await toolRes.json();
        const dur = Date.now() - startT;

        setEvents((prev) => [
          ...prev,
          {
            id: `evt_${Date.now()}`,
            type: "tool_call",
            name: "transfer_call",
            durationMs: dur || 140,
            input: { destination: "emergency_doctor", reason: "Severe facial pain" },
            output: toolData.data,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          },
        ]);

        setTimeout(() => {
          const replyText = "I'm so sorry you're experiencing pain. Because this sounds like an urgent dental condition, I am connecting you directly with Dr. Vance's emergency triage line right now. Please hold for just a moment.";
          setMessages((prev) => [
            ...prev,
            {
              id: `msg_${Date.now()}`,
              role: "assistant",
              text: replyText,
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
          setIsSpeaking(false);
        }, 500);
      } else {
        // General conversational response
        setTimeout(() => {
          const replyText = "Certainly! I'd be glad to help you with that. We can assist with appointment scheduling, insurance verification, or leaving a note for Dr. Vance.";
          setMessages((prev) => [
            ...prev,
            {
              id: `msg_${Date.now()}`,
              role: "assistant",
              text: replyText,
              time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
          setIsSpeaking(false);
        }, 500);
      }
    }, 700);
  };

  // Complete & Save Call
  const handleEndCall = async () => {
    if (!currentCallId) {
      setCallActive(false);
      return;
    }

    try {
      const toolNames = events.filter((e) => e.type === "tool_call").map((e) => e.name);
      const res = await fetch(`/api/calls/${currentCallId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          durationSeconds: 145,
          toolNamesUsed: toolNames,
        }),
      });

      const data = await res.json();
      setCompletedSummary(data.analysis);
      setCallActive(false);
    } catch (e) {
      console.error("Failed to complete call:", e);
      setCallActive(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Mode Indicator */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-white tracking-tight">AI Receptionist Voice Playground</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 uppercase">
              WebRTC / Simulator
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Test natural speech, live interruptions, RAG citations, and calendar tool execution in real-time.
          </p>
        </div>

        {/* Quick Scenario Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {SCENARIOS.map((scen, idx) => (
            <button
              key={idx}
              onClick={() => {
                setSelectedScenario(scen);
                handleStartCall(scen.callerFirstText);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-indigo-500/50 text-[11px] font-medium text-slate-300 hover:text-white transition flex items-center gap-1.5"
            >
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>{scen.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Split Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[640px]">
        {/* Left Column: Conversation & Audio Visualizer (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden glass-panel">
          {/* Audio Status Header */}
          <div className="p-4 border-b border-slate-800/80 bg-slate-950/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white">
                  <Bot className="w-5 h-5" />
                </div>
                {callActive && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-950" />
                )}
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  Ava — Front Desk AI
                  <span className="text-[10px] text-slate-400 font-normal">(Voice: Alloy)</span>
                </div>
                <div className="text-[10px] text-slate-400">
                  {callActive ? (
                    <span className="text-emerald-400 font-mono flex items-center gap-1">
                      <Radio className="w-3 h-3 animate-spin text-emerald-400" />
                      Live Call In Progress
                    </span>
                  ) : (
                    "Ready to connect"
                  )}
                </div>
              </div>
            </div>

            {/* Audio Waveform Visualization */}
            <div className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-900 border border-slate-800">
              {[8, 16, 24, 12, 28, 20, 10, 18, 26, 14, 22].map((height, i) => (
                <div
                  key={i}
                  className={`w-1 rounded-full transition-all duration-100 ${
                    callActive && isSpeaking
                      ? "bg-indigo-400 animate-waveform"
                      : callActive
                      ? "bg-emerald-500/60 h-2"
                      : "bg-slate-700 h-1.5"
                  }`}
                  style={{
                    height: callActive && isSpeaking ? `${height}px` : undefined,
                    animationDelay: `${i * 0.08}s`,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Transcript Message Scroll Area */}
          <div className="flex-1 p-5 overflow-y-auto space-y-3.5 max-h-[460px]">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Mic className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-200">Start an AI Receptionist Test Call</h4>
                  <p className="text-xs text-slate-400 max-w-sm mt-1">
                    Click one of the scenario templates above or click &quot;Start Call&quot; below to speak with Ava.
                  </p>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 ${msg.role === "caller" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0 text-xs font-bold">
                      A
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                      msg.role === "caller"
                        ? "bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-600/20"
                        : "bg-slate-800/90 text-slate-200 rounded-tl-none border border-slate-700/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 mb-1 text-[10px] opacity-70">
                      <span className="font-semibold">{msg.role === "caller" ? "You (Caller)" : "Ava"}</span>
                      <span className="font-mono">{msg.time}</span>
                    </div>
                    {msg.text}
                  </div>
                  {msg.role === "caller" && (
                    <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 text-xs font-bold">
                      U
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Caller Input & Controls Bar */}
          <div className="p-4 border-t border-slate-800/80 bg-slate-950/60 flex items-center gap-3">
            {callActive ? (
              <>
                <button
                  onClick={handleEndCall}
                  className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 transition shrink-0"
                >
                  <PhoneOff className="w-3.5 h-3.5" />
                  <span>End & Save</span>
                </button>

                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendCallerMessage(inputMessage)}
                    placeholder="Speak or type to Ava (e.g. 'Can I book 3:00 PM?')..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition"
                  />
                  <button
                    onClick={() => sendCallerMessage(inputMessage)}
                    disabled={!inputMessage.trim()}
                    className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="w-full flex items-center justify-between">
                <button
                  onClick={() => handleStartCall()}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition glow-primary"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Start New Voice Call</span>
                </button>

                <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Zero Latency Fast Speech Simulation
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Agent Activity Feed & Tool Inspector (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden glass-panel">
          <div className="p-4 border-b border-slate-800/80 bg-slate-950/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Agent Telemetry & Tool Calls</h3>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">{events.length} events logged</span>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-3 max-h-[540px]">
            {events.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-2">
                <Database className="w-8 h-8 text-slate-600" />
                <div className="text-xs font-medium text-slate-400">No active tool events yet</div>
                <div className="text-[11px] text-slate-500">
                  Tool invocations (availability checks, appointment creations, RAG lookups) will appear here in real time.
                </div>
              </div>
            ) : (
              events.map((evt) => (
                <div key={evt.id} className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-indigo-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                      {evt.name}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                      {evt.durationMs} ms
                    </span>
                  </div>

                  {evt.input && (
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">Inputs:</div>
                      <pre className="p-2 rounded-lg bg-slate-900 font-mono text-[11px] text-slate-300 overflow-x-auto mt-0.5">
                        {JSON.stringify(evt.input, null, 2)}
                      </pre>
                    </div>
                  )}

                  {evt.output && (
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-semibold">Output Data:</div>
                      <pre className="p-2 rounded-lg bg-slate-900/90 font-mono text-[11px] text-emerald-300 overflow-x-auto mt-0.5">
                        {typeof evt.output === "string" ? evt.output : JSON.stringify(evt.output, null, 2)}
                      </pre>
                    </div>
                  )}

                  <div className="text-[10px] text-slate-500 text-right font-mono">{evt.time}</div>
                </div>
              ))
            )}
            <div ref={eventsBottomRef} />
          </div>
        </div>
      </div>

      {/* Post-Call Intelligence Modal (when call completes) */}
      {completedSummary && (
        <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/40 border border-emerald-500/40 glass-panel space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
              <h3 className="text-sm font-bold text-white">Call Completed & Analyzed by AI</h3>
            </div>
            {currentCallId && (
              <Link
                href={`/dashboard/calls/${currentCallId}`}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
              >
                Inspect Call Record #{currentCallId.slice(-6)} <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Primary Outcome</span>
              <div className="font-bold text-emerald-400 text-sm mt-0.5 capitalize">
                {completedSummary.primaryOutcome?.replace(/_/g, " ")}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Detected Intent</span>
              <div className="font-bold text-slate-200 text-sm mt-0.5">{completedSummary.intent}</div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Caller Sentiment</span>
              <div className="font-bold text-slate-200 text-sm mt-0.5 capitalize">{completedSummary.sentiment}</div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
            <div className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Generated Structured Summary</div>
            <p className="text-slate-300 leading-relaxed">{completedSummary.summary}</p>
          </div>
        </div>
      )}
    </div>
  );
}
