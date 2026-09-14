"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bot,
  Mic,
  MicOff,
  PhoneOff,
  Play,
  Square,
  AlertCircle,
  Clock,
  Sparkles,
  CheckCircle2,
  Volume2,
  Settings,
  Activity,
  MessageSquare,
  Cpu,
  Info,
  ExternalLink,
  ShieldAlert,
  HelpCircle,
  Wrench,
  Check,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  BrowserVoiceSessionController,
  SessionConnectionState,
  AgentSpeechState,
  NormalizedTranscriptItem,
  NormalizedRealtimeEvent,
} from "@/lib/realtime/browser-voice-session";
import { ToolExecutionEvent } from "@/lib/realtime/client-tools";
import { apiFetch } from "@/lib/api";
import { ThemedDialog } from "@/components/ThemedDialog";

export default function VoicePlaygroundPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const receptionistId = params.id;

  // Workspace & Receptionist State
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [receptionist, setReceptionist] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Themed Dialog State
  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    type?: "confirm" | "alert" | "error" | "success";
    title: string;
    description: string;
    confirmText?: string;
    onConfirm: () => void;
  } | null>(null);

  // Playground Session State
  const [connectionState, setConnectionState] = useState<SessionConnectionState>("DISCONNECTED");
  const [speechState, setSpeechState] = useState<AgentSpeechState>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [transcripts, setTranscripts] = useState<NormalizedTranscriptItem[]>([]);
  const [events, setEvents] = useState<NormalizedRealtimeEvent[]>([]);
  const [toolExecutions, setToolExecutions] = useState<ToolExecutionEvent[]>([]);
  const [expandedToolId, setExpandedToolId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"conversation" | "tools" | "events" | "config" | "diagnostics">(
    "conversation"
  );

  // Active Session Metadata
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [testedVersion, setTestedVersion] = useState<number | null>(null);
  const [latestVersion, setLatestVersion] = useState<number | null>(null);
  const [sessionModel, setSessionModel] = useState<string>("gpt-realtime-2.1");
  const [sessionVoice, setSessionVoice] = useState<string>("sage");
  const [businessStatus, setBusinessStatus] = useState<string>("OPEN");
  const [initialGreeting, setInitialGreeting] = useState<string>("");
  const [activeInstructions, setActiveInstructions] = useState<string>("");

  // Timer State
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<any>(null);

  // Controller Ref
  const controllerRef = useRef<BrowserVoiceSessionController | null>(null);
  const transcriptsEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll conversation
  useEffect(() => {
    if (activeTab === "conversation") {
      transcriptsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [transcripts, activeTab]);

  // Timer effect
  useEffect(() => {
    if (connectionState === "CONNECTED") {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [connectionState]);

  // Load Initial Receptionist & Workspace Data
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // 1. Get user workspaces
        const workspaces = await apiFetch<any[]>("/api/v1/workspaces");
        if (!workspaces || workspaces.length === 0) {
          throw new Error("No workspace found. Please create or select a workspace.");
        }

        // 2. Try stored active workspace first, or locate receptionist across workspaces
        const storedSlug =
          typeof window !== "undefined" ? localStorage.getItem("rai_active_ws") : null;
        let candidateWs = workspaces.find((w) => w.slug === storedSlug) || workspaces[0];

        let recData: any = null;
        let resolvedWsId = candidateWs.id;

        try {
          recData = await apiFetch<any>(
            `/api/v1/workspaces/${candidateWs.id}/receptionists/${receptionistId}`
          );
        } catch {
          // If not in candidate workspace, search remaining workspaces
          let found = false;
          for (const ws of workspaces) {
            if (ws.id === candidateWs.id) continue;
            try {
              recData = await apiFetch<any>(
                `/api/v1/workspaces/${ws.id}/receptionists/${receptionistId}`
              );
              resolvedWsId = ws.id;
              found = true;
              break;
            } catch {
              // try next
            }
          }
          if (!found) {
            throw new Error("AI receptionist not found in your workspaces.");
          }
        }

        setWorkspaceId(resolvedWsId);
        setReceptionist(recData);
        setTestedVersion(recData.configurationVersion);
        setLatestVersion(recData.configurationVersion);
      } catch (err: any) {
        setFetchError(err.message || "Failed to initialize voice playground.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [receptionistId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (controllerRef.current) {
        controllerRef.current.disconnect();
        controllerRef.current = null;
      }
    };
  }, []);

  // Format seconds to MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Start Voice Test Session
  const handleStartSession = async () => {
    if (!workspaceId || !receptionist) return;

    try {
      setConnectionState("CONNECTING");
      setElapsedSeconds(0);
      setTranscripts([]);
      setEvents([]);
      setToolExecutions([]);

      // 1. Request test session & ephemeral clientSecret from backend
      const data = await apiFetch<any>(
        `/api/v1/workspaces/${workspaceId}/receptionists/${receptionist.id}/realtime-test-sessions`,
        {
          method: "POST",
          body: JSON.stringify({ metadata: { source: "browser_voice_playground" } }),
        }
      );
      setCurrentSessionId(data.testSessionId);
      setTestedVersion(data.configurationVersion);
      setSessionModel(data.runtime.model);
      setSessionVoice(data.runtime.voice);
      setBusinessStatus(data.runtime.businessStatus);
      setInitialGreeting(data.runtime.initialGreeting);
      setActiveInstructions(data.runtime.instructions);

      // 2. Initialize Browser Voice Controller
      const controller = new BrowserVoiceSessionController(
        {
          testSessionId: data.testSessionId,
          clientSecret: data.clientSecret,
          model: data.runtime.model,
          voice: data.runtime.voice,
          instructions: data.runtime.instructions,
          initialGreeting: data.runtime.initialGreeting,
          receptionistName: receptionist.name,
          receptionistRole: receptionist.roleTitle,
          allowedTools: data.runtime.allowedTools || [],
        },
        {
          onStateChange: (state) => setConnectionState(state),
          onSpeechStateChange: (spState) => setSpeechState(spState),
          onTranscriptUpdate: (items) => setTranscripts(items),
          onEvent: (evt) => setEvents((prev) => [evt, ...prev]),
          onAudioLevel: (lvl) => setAudioLevel(lvl),
          onToolExecution: (toolEvt) =>
            setToolExecutions((prev) => [toolEvt, ...prev.filter((e) => e.id !== toolEvt.id)]),
          onError: (err) => {
            console.error("Playground Controller Error:", err);
            setConnectionState("ERROR");
          },
        }
      );

      controllerRef.current = controller;
      await controller.connect();
    } catch (err: any) {
      setDialogConfig({
        isOpen: true,
        type: "error",
        title: "Could Not Start Voice Session",
        description: err.message || "Failed to initialize realtime voice connection.",
        confirmText: "Dismiss",
        onConfirm: () => setDialogConfig(null),
      });
      setConnectionState("ERROR");
    }
  };

  // Toggle Mute
  const handleToggleMute = () => {
    if (controllerRef.current) {
      const muted = controllerRef.current.toggleMute();
      setIsMuted(muted);
    }
  };

  // Interrupt Ava
  const handleInterrupt = () => {
    if (controllerRef.current) {
      controllerRef.current.interrupt();
    }
  };

  // End Voice Session
  const handleEndSession = async () => {
    if (controllerRef.current) {
      controllerRef.current.disconnect();
    }

    setConnectionState("ENDED");
    setSpeechState("idle");

    // Sync final session data and transcript to backend
    if (workspaceId && currentSessionId) {
      try {
        // Save transcript
        const currentItems = controllerRef.current
          ? controllerRef.current.getTranscriptItems()
          : transcripts;
        if (currentItems.length > 0) {
          await apiFetch(
            `/api/v1/workspaces/${workspaceId}/realtime-test-sessions/${currentSessionId}/transcript`,
            {
              method: "POST",
              body: JSON.stringify({
                items: currentItems.map((item, idx) => ({
                  sequence: idx,
                  role: item.role,
                  type: "message",
                  text: item.text,
                })),
              }),
            }
          ).catch((e) => console.warn("Failed to persist transcript:", e));
        }

        // Mark session completed
        await apiFetch(
          `/api/v1/workspaces/${workspaceId}/realtime-test-sessions/${currentSessionId}/end`,
          {
            method: "POST",
            body: JSON.stringify({
              disconnectReason: "User manually ended session in voice playground",
              clientDurationSeconds: elapsedSeconds,
            }),
          }
        ).catch((e) => console.warn("Failed to end session on server:", e));
      } catch (err) {
        console.warn("Failed to persist final test session summary:", err);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 font-medium">Initializing Voice Playground...</p>
        </div>
      </div>
    );
  }

  if (fetchError || !receptionist) {
    return (
      <div className="max-w-xl mx-auto my-12 p-6 bg-rose-500/10 border border-rose-500/20 rounded-xl text-center">
        <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-white mb-2">Could Not Open Playground</h2>
        <p className="text-slate-300 text-sm mb-6">{fetchError || "Receptionist not found."}</p>
        <Link
          href={`/receptionists/${receptionistId}`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Builder
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Link
            href={`/receptionists/${receptionist.id}`}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="Return to Builder"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">{receptionist.name}</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Voice Playground
              </span>
              <span className="text-xs px-2 py-0.5 rounded-md font-mono bg-slate-800 text-slate-300 border border-slate-700">
                Tested: v{testedVersion || receptionist.configurationVersion}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {receptionist.roleTitle} • Realtime WebRTC browser testing environment
            </p>
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                connectionState === "CONNECTED"
                  ? "bg-emerald-400 animate-pulse"
                  : connectionState === "CONNECTING"
                    ? "bg-amber-400 animate-bounce"
                    : connectionState === "ERROR"
                      ? "bg-rose-400"
                      : "bg-slate-500"
              }`}
            />
            <span className="text-xs font-medium text-slate-300">
              {connectionState === "CONNECTED"
                ? "Live Connected"
                : connectionState === "CONNECTING"
                  ? "Connecting WebRTC..."
                  : connectionState === "ENDING"
                    ? "Ending Session..."
                    : connectionState === "ENDED"
                      ? "Session Completed"
                      : connectionState === "ERROR"
                        ? "Connection Error"
                        : "Ready to Test"}
            </span>
            {connectionState === "CONNECTED" && (
              <span className="text-xs font-mono text-emerald-400 font-semibold pl-1">
                {formatTime(elapsedSeconds)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Version Warning if newer version exists */}
      {latestVersion && testedVersion && latestVersion > testedVersion && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-3 text-amber-300 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>
            The receptionist configuration was updated to <strong>v{latestVersion}</strong> while
            this test session was active. End this session to test the newer version.
          </span>
        </div>
      )}

      {/* Privacy Notice Alert */}
      <div className="p-3 bg-slate-800/50 border border-slate-700/60 rounded-lg flex items-center gap-3 text-xs text-slate-400">
        <ShieldAlert className="w-4 h-4 text-indigo-400 flex-shrink-0" />
        <span>
          <strong>Testing Sandbox:</strong> Realtime browser audio is streamed directly to OpenAI
          Realtime via WebRTC using an ephemeral, short-lived token. Do not state real payment
          details or confidential medical records.
        </span>
      </div>

      {/* Main Interactive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Console Panel: Audio Visualizer & Call Controls */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-between text-center relative overflow-hidden min-h-[420px]">
            {/* Background ambient glow */}
            <div
              className={`absolute inset-0 transition-opacity duration-700 pointer-events-none ${
                speechState === "speaking"
                  ? "bg-gradient-to-b from-indigo-500/10 via-transparent to-transparent opacity-100"
                  : speechState === "listening"
                    ? "bg-gradient-to-b from-emerald-500/10 via-transparent to-transparent opacity-100"
                    : "opacity-0"
              }`}
            />

            {/* Top metadata tags */}
            <div className="w-full flex justify-between items-center text-xs text-slate-400 z-10 mb-4">
              <span className="flex items-center gap-1.5 font-mono">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                {formatTime(elapsedSeconds)}
              </span>
              <span className="capitalize px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-medium">
                {speechState === "speaking"
                  ? `${receptionist.name} Speaking`
                  : speechState === "listening"
                    ? "Listening to Caller"
                    : speechState === "interrupted"
                      ? "Barge-in Paused"
                      : connectionState === "CONNECTED"
                        ? "Connected"
                        : "Idle"}
              </span>
            </div>

            {/* Interactive Animated Avatar Sphere */}
            <div className="my-auto relative flex items-center justify-center z-10">
              {/* Outer pulsing ripple when speaking */}
              {connectionState === "CONNECTED" && speechState === "speaking" && (
                <>
                  <div className="absolute w-44 h-44 rounded-full bg-indigo-500/20 animate-ping pointer-events-none" />
                  <div className="absolute w-52 h-52 rounded-full border border-indigo-500/30 animate-pulse pointer-events-none" />
                </>
              )}

              {/* Listening ripple */}
              {connectionState === "CONNECTED" && speechState === "listening" && (
                <div
                  className="absolute rounded-full bg-emerald-500/20 transition-all pointer-events-none"
                  style={{
                    width: `${120 + audioLevel * 70}px`,
                    height: `${120 + audioLevel * 70}px`,
                  }}
                />
              )}

              <div
                className={`w-32 h-32 rounded-full flex items-center justify-center border-4 shadow-2xl transition-all duration-300 ${
                  connectionState === "CONNECTED"
                    ? speechState === "speaking"
                      ? "bg-indigo-600 border-indigo-400 shadow-indigo-500/40 scale-105"
                      : speechState === "listening"
                        ? "bg-slate-800 border-emerald-400 shadow-emerald-500/30"
                        : "bg-slate-800 border-slate-600"
                    : connectionState === "CONNECTING"
                      ? "bg-amber-600/30 border-amber-400 animate-pulse"
                      : "bg-slate-800 border-slate-700"
                }`}
              >
                <Bot
                  className={`w-14 h-14 ${
                    connectionState === "CONNECTED"
                      ? speechState === "speaking"
                        ? "text-white animate-bounce"
                        : "text-emerald-400"
                      : "text-slate-400"
                  }`}
                />
              </div>
            </div>

            {/* Audio Activity Meter Bar */}
            {connectionState === "CONNECTED" && (
              <div className="w-full max-w-xs space-y-1.5 z-10 mt-4 mb-2">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Microphone Input</span>
                  <span className="font-mono">
                    {isMuted ? "MUTED" : `${Math.round(audioLevel * 100)}%`}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                  <div
                    className={`h-full transition-all duration-75 rounded-full ${
                      isMuted
                        ? "bg-rose-500 w-full opacity-40"
                        : audioLevel > 0.6
                          ? "bg-emerald-400"
                          : "bg-indigo-500"
                    }`}
                    style={{ width: isMuted ? "100%" : `${Math.max(5, audioLevel * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Session Action Controls */}
            <div className="w-full pt-4 z-10">
              {connectionState !== "CONNECTED" && connectionState !== "CONNECTING" ? (
                <button
                  type="button"
                  onClick={handleStartSession}
                  className="w-full py-3.5 px-6 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-medium rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2.5 transition-all text-sm group"
                >
                  <Play className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
                  <span>Start Voice Test Session</span>
                </button>
              ) : connectionState === "CONNECTING" ? (
                <div className="w-full py-3.5 px-6 bg-slate-800 border border-slate-700 text-slate-300 font-medium rounded-xl flex items-center justify-center gap-3 text-sm">
                  <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  <span>Establishing WebRTC Media Stream...</span>
                </div>
              ) : (
                <div className="flex items-center gap-3 w-full">
                  {/* Mute Button */}
                  <button
                    type="button"
                    onClick={handleToggleMute}
                    className={`flex-1 py-3 px-4 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-colors border ${
                      isMuted
                        ? "bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30"
                        : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
                    }`}
                  >
                    {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    <span>{isMuted ? "Unmute Mic" : "Mute Mic"}</span>
                  </button>

                  {/* Interrupt Button */}
                  {speechState === "speaking" && (
                    <button
                      type="button"
                      onClick={handleInterrupt}
                      className="py-3 px-3.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
                      title="Interrupt Ava immediately"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Interrupt</span>
                    </button>
                  )}

                  {/* End Session Button */}
                  <button
                    type="button"
                    onClick={handleEndSession}
                    className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-medium text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20 transition-colors"
                  >
                    <PhoneOff className="w-4 h-4" />
                    <span>End Test</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Quick Test Prompt Chips */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Suggested Test Scenarios to Speak
            </h3>
            <div className="space-y-1.5 text-xs">
              {[
                { title: "Business Hours", prompt: "What are your business hours and location?" },
                {
                  title: "New Appointment",
                  prompt: "I'd like to schedule a dental checkup tomorrow morning.",
                },
                { title: "Transfer Request", prompt: "Can you transfer me to someone in billing?" },
                {
                  title: "Barge-in / Interrupt",
                  prompt: "Speak over Ava while she is answering to verify natural interruption.",
                },
                { title: "Insurance Query", prompt: "Do you accept MetLife dental insurance?" },
              ].map((chip, i) => (
                <div
                  key={i}
                  className="p-2 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 rounded-lg text-slate-300 flex items-start justify-between gap-2"
                >
                  <div>
                    <span className="font-semibold text-indigo-300 text-[11px] block">
                      {chip.title}
                    </span>
                    <span className="text-slate-400 italic text-[11px]">
                      &quot;{chip.prompt}&quot;
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Drawer: Multi-Tab Live Transcript & Diagnostics */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col min-h-[580px]">
          {/* Tab Navigation */}
          <div className="flex border-b border-slate-800 px-4 pt-3 bg-slate-900/80 gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("conversation")}
              className={`flex items-center gap-2 pb-3 px-3 text-xs font-medium border-b-2 transition-colors ${
                activeTab === "conversation"
                  ? "border-indigo-500 text-white font-semibold"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Live Conversation</span>
              {transcripts.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded-full font-mono">
                  {transcripts.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("tools")}
              className={`flex items-center gap-2 pb-3 px-3 text-xs font-medium border-b-2 transition-colors ${
                activeTab === "tools"
                  ? "border-indigo-500 text-white font-semibold"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Wrench className="w-4 h-4" />
              <span>Tool Activity</span>
              {toolExecutions.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 rounded-full font-mono font-semibold">
                  {toolExecutions.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("events")}
              className={`flex items-center gap-2 pb-3 px-3 text-xs font-medium border-b-2 transition-colors ${
                activeTab === "events"
                  ? "border-indigo-500 text-white font-semibold"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Events</span>
              {events.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded-full font-mono">
                  {events.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("config")}
              className={`flex items-center gap-2 pb-3 px-3 text-xs font-medium border-b-2 transition-colors ${
                activeTab === "config"
                  ? "border-indigo-500 text-white font-semibold"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Tested Runtime Config</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("diagnostics")}
              className={`flex items-center gap-2 pb-3 px-3 text-xs font-medium border-b-2 transition-colors ${
                activeTab === "diagnostics"
                  ? "border-indigo-500 text-white font-semibold"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span>Diagnostics</span>
            </button>
          </div>

          {/* Tab 1: Live Conversation Transcript */}
          {activeTab === "conversation" && (
            <div className="flex-1 p-6 overflow-y-auto max-h-[500px] space-y-4">
              {transcripts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-16">
                  <Volume2 className="w-12 h-12 text-slate-700 mb-3" />
                  <p className="font-medium text-slate-400 text-sm">No speech captured yet</p>
                  <p className="text-xs max-w-sm mt-1">
                    Click &quot;Start Voice Test Session&quot; and allow microphone access. Ava will
                    speak her initial greeting, and caller responses will appear here in real time.
                  </p>
                </div>
              ) : (
                transcripts.map((item) => (
                  <div
                    key={item.id}
                    className={`flex flex-col ${item.role === "USER" ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-1 px-1">
                      <span className="font-semibold text-slate-300">
                        {item.role === "USER" ? "Caller (You)" : receptionist.name}
                      </span>
                      <span>•</span>
                      <span>{item.timestamp}</span>
                      {!item.isFinal && <span className="text-indigo-400 italic">speaking...</span>}
                    </div>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                        item.role === "USER"
                          ? "bg-indigo-600 text-white rounded-br-none shadow-md shadow-indigo-600/10"
                          : "bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700/60"
                      }`}
                    >
                      {item.text}
                    </div>
                  </div>
                ))
              )}
              <div ref={transcriptsEndRef} />
            </div>
          )}

          {/* Tab 2: Trusted Tool Activity */}
          {activeTab === "tools" && (
            <div className="flex-1 p-6 overflow-y-auto max-h-[500px] space-y-3">
              {toolExecutions.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-16">
                  <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mb-3 text-slate-400">
                    <Wrench className="w-6 h-6 text-indigo-400" />
                  </div>
                  <p className="font-medium text-slate-300 text-sm">No business tools executed yet</p>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">
                    When the caller asks about business hours, company information, leaves a message,
                    or provides contact details, Ava will securely invoke server-side tools in real time.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-1.5 mt-4 max-w-md">
                    {[
                      "get_business_information",
                      "get_business_hours",
                      "find_contact",
                      "create_contact",
                      "create_lead",
                      "take_message",
                      "request_callback",
                    ].map((name) => (
                      <span
                        key={name}
                        className="px-2 py-0.5 text-[11px] font-mono bg-slate-800/80 text-slate-400 border border-slate-700/50 rounded-md"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                toolExecutions.map((item) => {
                  const isExpanded = expandedToolId === item.id;
                  return (
                    <div
                      key={item.id}
                      className="border border-slate-800 bg-slate-900/90 rounded-xl overflow-hidden text-xs transition-colors hover:border-slate-700"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedToolId(isExpanded ? null : item.id)}
                        className="w-full p-3.5 flex items-center justify-between text-left gap-3 hover:bg-slate-800/30"
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          {item.status === "SUCCEEDED" ? (
                            <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                              <Check className="w-3 h-3" />
                            </span>
                          ) : item.status === "FAILED" ? (
                            <span className="w-5 h-5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center flex-shrink-0">
                              <AlertCircle className="w-3 h-3" />
                            </span>
                          ) : (
                            <span className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                              <div className="w-2.5 h-2.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                            </span>
                          )}

                          <span className="font-mono text-xs font-semibold text-indigo-300">
                            {item.toolName}
                          </span>

                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${
                              item.status === "SUCCEEDED"
                                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                                : item.status === "FAILED"
                                  ? "bg-rose-500/15 text-rose-400 border border-rose-500/20"
                                  : "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-slate-400 flex-shrink-0">
                          {item.durationMs !== undefined && (
                            <span className="font-mono text-[11px] text-slate-400">
                              {item.durationMs}ms
                            </span>
                          )}
                          <span className="text-[11px] text-slate-500">
                            {new Date(item.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </span>
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="p-4 bg-slate-950/60 border-t border-slate-800/80 space-y-3 font-mono text-[11px]">
                          <div>
                            <span className="text-[10px] font-sans font-medium text-slate-400 uppercase tracking-wider block mb-1">
                              Input Arguments:
                            </span>
                            <pre className="p-2.5 bg-slate-900 rounded-lg text-indigo-200 overflow-x-auto border border-slate-800">
                              {JSON.stringify(item.arguments, null, 2)}
                            </pre>
                          </div>

                          {item.result && (
                            <div>
                              <span className="text-[10px] font-sans font-medium text-emerald-400 uppercase tracking-wider block mb-1">
                                Gateway Response (Trusted Backend Result):
                              </span>
                              <pre className="p-2.5 bg-slate-900 rounded-lg text-emerald-200 overflow-x-auto border border-slate-800">
                                {JSON.stringify(item.result, null, 2)}
                              </pre>
                            </div>
                          )}

                          {item.error && (
                            <div>
                              <span className="text-[10px] font-sans font-medium text-rose-400 uppercase tracking-wider block mb-1">
                                Error Details:
                              </span>
                              <pre className="p-2.5 bg-slate-900 rounded-lg text-rose-300 overflow-x-auto border border-rose-900/30">
                                {JSON.stringify(item.error, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Tab 3: Event Timeline */}
          {activeTab === "events" && (
            <div className="flex-1 p-6 overflow-y-auto max-h-[500px] space-y-3">
              {events.length === 0 ? (
                <div className="text-center py-16 text-slate-500 text-xs">
                  No session events recorded yet. Start a session to stream WebRTC transport events.
                </div>
              ) : (
                events.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-3 bg-slate-800/50 border border-slate-800 rounded-lg flex items-start gap-3 text-xs"
                  >
                    <span
                      className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                        evt.type === "session_connected"
                          ? "bg-emerald-400"
                          : evt.type === "speech_started"
                            ? "bg-indigo-400"
                            : evt.type === "audio_interrupted"
                              ? "bg-amber-400"
                              : evt.type === "error"
                                ? "bg-rose-400"
                                : "bg-slate-400"
                      }`}
                    />
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-200">{evt.summary}</span>
                        <span className="text-[10px] font-mono text-slate-500">
                          {evt.timestamp}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mt-0.5 block">
                        {evt.type}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 3: Configuration Snapshot */}
          {activeTab === "config" && (
            <div className="flex-1 p-6 overflow-y-auto max-h-[500px] space-y-4 text-xs">
              <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-800 space-y-2">
                <span className="text-slate-400 font-medium block">Voice Persona & Model</span>
                <div className="grid grid-cols-2 gap-3 text-slate-300">
                  <div>
                    <span className="text-slate-500 text-[11px] block">OpenAI Voice:</span>
                    <span className="font-mono font-semibold text-indigo-400 uppercase">
                      {sessionVoice}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Realtime Model:</span>
                    <span className="font-mono text-slate-200">{sessionModel}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Business Status:</span>
                    <span className="font-semibold text-emerald-400">{businessStatus}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Primary Language:</span>
                    <span className="font-medium text-slate-200">
                      {receptionist.primaryLanguage}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-800 space-y-1.5">
                <span className="text-slate-400 font-medium block">Active Greeting</span>
                <p className="text-slate-200 italic bg-slate-900 p-3 rounded-lg border border-slate-800">
                  &quot;{initialGreeting || receptionist.greeting}&quot;
                </p>
              </div>

              <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-800 space-y-1.5">
                <span className="text-slate-400 font-medium block">
                  Platform Safety & Stood-up Instructions
                </span>
                <pre className="text-[11px] font-mono text-slate-300 bg-slate-900 p-3 rounded-lg border border-slate-800 overflow-x-auto whitespace-pre-wrap max-h-48">
                  {activeInstructions ||
                    receptionist.instructions ||
                    "Welcome callers warmly and assist them with their inquiries."}
                </pre>
              </div>
            </div>
          )}

          {/* Tab 4: Diagnostics */}
          {activeTab === "diagnostics" && (
            <div className="flex-1 p-6 overflow-y-auto max-h-[500px] space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-800/40 rounded-lg border border-slate-800">
                  <span className="text-slate-500 text-[11px] block">Session ID</span>
                  <span className="font-mono text-slate-200 font-semibold">
                    {currentSessionId || "N/A"}
                  </span>
                </div>
                <div className="p-3 bg-slate-800/40 rounded-lg border border-slate-800">
                  <span className="text-slate-500 text-[11px] block">Connection State</span>
                  <span className="font-mono text-indigo-400 font-semibold uppercase">
                    {connectionState}
                  </span>
                </div>
                <div className="p-3 bg-slate-800/40 rounded-lg border border-slate-800">
                  <span className="text-slate-500 text-[11px] block">Duration</span>
                  <span className="font-mono text-slate-200">
                    {formatTime(elapsedSeconds)} ({elapsedSeconds}s)
                  </span>
                </div>
                <div className="p-3 bg-slate-800/40 rounded-lg border border-slate-800">
                  <span className="text-slate-500 text-[11px] block">Transcript Items</span>
                  <span className="font-mono text-slate-200">{transcripts.length} items</span>
                </div>
                <div className="p-3 bg-slate-800/40 rounded-lg border border-slate-800">
                  <span className="text-slate-500 text-[11px] block">Transport</span>
                  <span className="font-mono text-slate-200">WebRTC (PeerConnection)</span>
                </div>
                <div className="p-3 bg-slate-800/40 rounded-lg border border-slate-800">
                  <span className="text-slate-500 text-[11px] block">Credential Type</span>
                  <span className="font-mono text-slate-200">Ephemeral Client Secret (ek_*)</span>
                </div>
              </div>

              <div className="p-4 bg-slate-800/20 border border-slate-800 rounded-lg">
                <span className="text-slate-400 font-medium block mb-1">
                  Architecture Boundary Notice
                </span>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  The voice playground uses client-side WebRTC via OpenAI Realtime. Privileged
                  database mutations (such as calendar appointment booking, CRM customer creation,
                  and telephone transfers) are intentionally detached in this testing runtime for
                  tenant security.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Themed Dialog */}
      {dialogConfig && (
        <ThemedDialog
          isOpen={dialogConfig.isOpen}
          type={dialogConfig.type}
          title={dialogConfig.title}
          description={dialogConfig.description}
          confirmText={dialogConfig.confirmText}
          onConfirm={dialogConfig.onConfirm}
          onCancel={() => setDialogConfig(null)}
        />
      )}
    </div>
  );
}
