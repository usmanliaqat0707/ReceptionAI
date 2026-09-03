"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Bot,
  ArrowLeft,
  Save,
  Mic,
  Sliders,
  Sparkles,
  Volume2,
  Clock,
  ShieldAlert,
  CheckCircle2,
  Calendar,
  Layers,
} from "lucide-react";

export default function ReceptionistBuilderPage({
  params,
}: {
  params: { id: string };
}) {
  const [activeTab, setActiveTab] = useState<"identity" | "voice" | "personality" | "greetings" | "instructions" | "objectives">("identity");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Form State
  const [name, setName] = useState("Ava");
  const [role, setRole] = useState("Dental Office Receptionist");
  const [industry, setIndustry] = useState("dental");
  const [language, setLanguage] = useState("en-US");
  const [description, setDescription] = useState("");
  const [voice, setVoice] = useState("alloy");
  const [speed, setSpeed] = useState(1.0);
  const [responseLength, setResponseLength] = useState("concise");
  const [interruptionHandling, setInterruptionHandling] = useState(true);
  const [selectedTraits, setSelectedTraits] = useState<string[]>(["Professional", "Friendly", "Warm", "Concise"]);
  const [greeting, setGreeting] = useState("");
  const [afterHoursGreeting, setAfterHoursGreeting] = useState("");
  const [instructions, setInstructions] = useState("");
  const [objectives, setObjectives] = useState({
    answerQuestions: true,
    bookAppointments: true,
    captureLeads: true,
    takeMessages: true,
    transferEmergency: true,
  });

  useEffect(() => {
    fetch(`/api/receptionists/${params.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.receptionist) {
          const r = data.receptionist;
          setName(r.name || "Ava");
          setRole(r.role || "Dental Office Receptionist");
          setIndustry(r.industry || "dental");
          setLanguage(r.language || "en-US");
          setDescription(r.description || "");
          setGreeting(r.greeting || "");
          setAfterHoursGreeting(r.afterHoursGreeting || "");
          setInstructions(r.instructions || "");

          const vCfg = r.voiceConfig as any;
          if (vCfg) {
            setVoice(vCfg.voice || "alloy");
            setSpeed(vCfg.speed || 1.0);
            setResponseLength(vCfg.responseLength || "concise");
            setInterruptionHandling(vCfg.interruptionHandling ?? true);
          }

          const pCfg = r.personalityConfig as any;
          if (pCfg?.traits) {
            setSelectedTraits(pCfg.traits);
          }

          const objCfg = r.objectiveConfig as any;
          if (objCfg) {
            setObjectives(objCfg);
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleSave = async () => {
    setSaving(true);
    setSavedSuccess(false);

    try {
      await fetch(`/api/receptionists/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          role,
          industry,
          language,
          description,
          greeting,
          afterHoursGreeting,
          instructions,
          voiceConfig: {
            voice,
            speed,
            responseLength,
            interruptionHandling,
          },
          personalityConfig: {
            traits: selectedTraits,
            tone: selectedTraits.includes("Friendly") ? "friendly" : "professional",
          },
          objectiveConfig: objectives,
        }),
      });

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const traitOptions = ["Professional", "Friendly", "Warm", "Formal", "Concise", "Energetic", "Calm", "Patient"];
  const voiceOptions = [
    { id: "alloy", label: "Alloy (Neutral & balanced)" },
    { id: "echo", label: "Echo (Warm & reassuring)" },
    { id: "shimmer", label: "Shimmer (Expressive & clear)" },
    { id: "ash", label: "Ash (Calm & conversational)" },
    { id: "ballad", label: "Ballad (Smooth & poised)" },
    { id: "coral", label: "Coral (Energetic & engaging)" },
    { id: "sage", label: "Sage (Authoritative & measured)" },
    { id: "verse", label: "Verse (Dynamic & versatile)" },
  ];

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-slate-400">
        Loading receptionist configuration...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/dashboard/receptionists"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Receptionists</span>
          </Link>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-extrabold text-white tracking-tight">{name} Builder</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              Voice Configuration
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {savedSuccess && (
            <span className="text-xs text-emerald-400 flex items-center gap-1 font-semibold animate-pulse">
              <CheckCircle2 className="w-4 h-4" /> Saved!
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-2 glow-primary disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "Saving..." : "Save Configuration"}</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto gap-1 border-b border-slate-800/80 pb-2">
        {[
          { id: "identity", label: "Identity" },
          { id: "voice", label: "Voice & Audio" },
          { id: "personality", label: "Personality" },
          { id: "greetings", label: "Greetings & Hours" },
          { id: "instructions", label: "Instructions" },
          { id: "objectives", label: "Objectives & Tools" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition shrink-0 ${
              activeTab === tab.id
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 glass-panel space-y-6">
        {/* Tab 1: Identity */}
        {activeTab === "identity" && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white">Receptionist Identity</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Receptionist Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Business Role</label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Industry Template</label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="dental">Dental Clinic</option>
                  <option value="medical">Medical Clinic</option>
                  <option value="legal">Law Firm</option>
                  <option value="realestate">Real Estate Agency</option>
                  <option value="salon">Salon & Spa</option>
                  <option value="homeservices">Home Services (HVAC/Plumbing)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Primary Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="en-US">English (United States)</option>
                  <option value="en-GB">English (United Kingdom)</option>
                  <option value="es-US">Spanish (United States)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Internal Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        )}

        {/* Tab 2: Voice & Audio */}
        {activeTab === "voice" && (
          <div className="space-y-5">
            <h3 className="text-sm font-bold text-white">Realtime Voice Model & Speech Parameters</h3>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-2">Voice Model (Realtime WebRTC)</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {voiceOptions.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setVoice(v.id)}
                    className={`p-3 rounded-xl border text-left text-xs transition flex items-center justify-between ${
                      voice === v.id
                        ? "bg-indigo-600/20 border-indigo-500 text-white font-semibold"
                        : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <span>{v.label}</span>
                    {voice === v.id && <span className="text-indigo-400 font-bold">✓</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3">
              <div>
                <div className="flex items-center justify-between text-xs mb-1 font-semibold text-slate-300">
                  <span>Speaking Speed</span>
                  <span className="font-mono text-indigo-400">{speed}x</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="1.3"
                  step="0.05"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Spoken Response Length</label>
                <select
                  value={responseLength}
                  onChange={(e) => setResponseLength(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="concise">Concise (Recommended for Voice)</option>
                  <option value="balanced">Balanced</option>
                  <option value="detailed">Detailed</option>
                </select>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-white">Natural Interruption Handling</div>
                <div className="text-[11px] text-slate-400">Instantly halt agent audio playback when the caller begins speaking.</div>
              </div>
              <input
                type="checkbox"
                checked={interruptionHandling}
                onChange={(e) => setInterruptionHandling(e.target.checked)}
                className="w-4 h-4 accent-indigo-500 rounded"
              />
            </div>
          </div>
        )}

        {/* Tab 3: Personality */}
        {activeTab === "personality" && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white">Personality Preset Traits</h3>
            <p className="text-xs text-slate-400">
              Select traits that govern Ava&apos;s tone, warmth, and conversational demeanour over phone calls.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
              {traitOptions.map((trait) => {
                const isSelected = selectedTraits.includes(trait);
                return (
                  <button
                    key={trait}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedTraits(selectedTraits.filter((t) => t !== trait));
                      } else {
                        setSelectedTraits([...selectedTraits, trait]);
                      }
                    }}
                    className={`p-3 rounded-xl border text-center text-xs font-semibold transition ${
                      isSelected
                        ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {trait}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 4: Greetings & Hours */}
        {activeTab === "greetings" && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white">Spoken Greetings & Schedules</h3>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Standard Business Hours Greeting
              </label>
              <textarea
                value={greeting}
                onChange={(e) => setGreeting(e.target.value)}
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                After-Hours Spoken Greeting
              </label>
              <textarea
                value={afterHoursGreeting}
                onChange={(e) => setAfterHoursGreeting(e.target.value)}
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        )}

        {/* Tab 5: Instructions */}
        {activeTab === "instructions" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">System Instructions</h3>
              <span className="text-[10px] text-slate-400">Layer 3 of System Prompt</span>
            </div>

            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={12}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 leading-relaxed"
            />
          </div>
        )}

        {/* Tab 6: Objectives & Tools */}
        {activeTab === "objectives" && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white">Receptionist Objectives & Active Toolsets</h3>
            <p className="text-xs text-slate-400">
              Each enabled objective activates corresponding authorized tool functions in the voice runtime.
            </p>

            <div className="space-y-2.5 pt-2">
              {[
                { key: "answerQuestions", label: "Answer General Inquiries", desc: "Enables search_knowledge_base with pgvector RAG for clinic FAQs, pricing, insurance" },
                { key: "bookAppointments", label: "Book & Schedule Appointments", desc: "Enables check_availability and book_appointment with real calendar slots" },
                { key: "captureLeads", label: "Capture & Qualify Leads", desc: "Enables create_lead with contact extraction and prospective valuation" },
                { key: "takeMessages", label: "Take Structured Callback Messages", desc: "Enables take_message with caller urgency classification" },
                { key: "transferEmergency", label: "Transfer Medical Emergencies", desc: "Enables transfer_call to doctor triage line when emergency keywords detected" },
              ].map((obj) => (
                <label
                  key={obj.key}
                  className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-start gap-3 cursor-pointer hover:border-slate-700 transition"
                >
                  <input
                    type="checkbox"
                    checked={(objectives as any)[obj.key]}
                    onChange={(e) => setObjectives({ ...objectives, [obj.key]: e.target.checked })}
                    className="w-4 h-4 accent-indigo-500 rounded mt-0.5"
                  />
                  <div>
                    <div className="text-xs font-semibold text-white">{obj.label}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{obj.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
