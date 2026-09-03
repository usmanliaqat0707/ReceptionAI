import Link from "next/link";
import {
  Mic,
  Bot,
  CalendarCheck2,
  PhoneCall,
  ShieldCheck,
  Zap,
  CheckCircle2,
  ArrowRight,
  Database,
  Building2,
  Sparkles,
  PhoneForwarded,
  Activity,
  Layers,
} from "lucide-react";

export default function LandingPage() {
  const industries = [
    { title: "Dental Clinics", desc: "Book cleanings, verify PPO insurance, and triage emergencies.", active: true },
    { title: "Law Firms", desc: "Screen legal inquiries and schedule initial paid consultations.", active: true },
    { title: "Medical Practices", desc: "Triage patient symptoms and route urgent calls directly to doctors." },
    { title: "Real Estate Agencies", desc: "Qualify buyers, capture pre-approvals, and schedule property showings." },
    { title: "Home Services", desc: "Dispatch HVAC/plumbing technicians with immediate emergency pricing." },
    { title: "Salons & Spas", desc: "Coordinate multi-service bookings and stylists across business calendars." },
  ];

  const features = [
    {
      icon: Mic,
      title: "Realtime Voice WebRTC",
      desc: "Sub-400ms speech-to-speech response times with natural turn-taking and instant interruption handling.",
    },
    {
      icon: CalendarCheck2,
      title: "Zero-Hallucination Scheduling",
      desc: "Queries real-time calendar availability before offering slots. Never invents appointment times.",
    },
    {
      icon: Database,
      title: "Hybrid RAG Knowledge Retrieval",
      desc: "Answers complex business policies, pricing, and insurance FAQs directly from indexed knowledge chunks.",
    },
    {
      icon: PhoneForwarded,
      title: "Intelligent Human Handoff",
      desc: "Seamlessly routes medical emergencies, high-value leads, or VIP callers to staff or on-call doctors.",
    },
    {
      icon: Sparkles,
      title: "Post-Call Intelligence",
      desc: "Automatically extracts structured summaries, intent, sentiment, and updates CRM records upon call completion.",
    },
    {
      icon: ShieldCheck,
      title: "Strict Multi-Tenant Isolation",
      desc: "Enforced database boundaries, hashed API keys, signed HMAC webhooks, and prompt-injection defenses.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Navigation */}
      <header className="border-b border-slate-800/80 bg-[#090e1a]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <span className="font-extrabold text-lg tracking-tight text-white">
              Reception<span className="text-indigo-400 font-extrabold">AI</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
            <a href="#features" className="hover:text-indigo-400 transition">Features</a>
            <a href="#demo" className="hover:text-indigo-400 transition">Interactive Demo</a>
            <a href="#architecture" className="hover:text-indigo-400 transition">Architecture</a>
            <a href="#industries" className="hover:text-indigo-400 transition">Industries</a>
            <a href="#pricing" className="hover:text-indigo-400 transition">Plans</a>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition border border-indigo-400/30 glow-primary flex items-center gap-1.5"
            >
              <span>Launch Demo Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-16 px-6 overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-indigo-600/15 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 left-1/3 w-[300px] h-[250px] bg-purple-600/15 blur-[100px] rounded-full pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/90 border border-indigo-500/30 text-xs font-semibold text-indigo-400 shadow-inner">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Voice Receptionist Multi-Tenant SaaS Platform</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-[1.1]">
            Turn Every Business Phone Call into a{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Booked Customer
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            ReceptionAI replaces rigid phone menus with natural, continuous voice AI. Understands caller intent, queries real-time calendar availability, books appointments, and captures leads 24/7.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
            <Link
              href="/dashboard/playground"
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-bold shadow-xl shadow-indigo-600/30 transition border border-indigo-400/40 glow-primary flex items-center gap-2"
            >
              <Mic className="w-4 h-4 animate-pulse" />
              <span>Talk to Ava (Live Voice Demo)</span>
            </Link>

            <Link
              href="/dashboard"
              className="px-6 py-3.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 text-sm font-semibold border border-slate-700/80 transition flex items-center gap-2"
            >
              <span>Explore 250 Call Records</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Trust badges */}
          <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 font-medium">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Sub-400ms Spoken Latency</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Zero-Hallucination Scheduling</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>SOC2 Compliant Multi-Tenancy</span>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Live Demo Preview Box */}
      <section id="demo" className="py-12 px-6 max-w-5xl mx-auto">
        <div className="p-6 md:p-8 rounded-3xl bg-slate-900/90 border border-indigo-500/40 glass-panel shadow-2xl relative overflow-hidden space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  Live Receptionist Simulator: Ava
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    ONLINE
                  </span>
                </h3>
                <p className="text-xs text-slate-400">Bright Dental Clinic • Assigned Line: +1 (541) 555-0199</p>
              </div>
            </div>

            <Link
              href="/dashboard/playground"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition self-start"
            >
              <span>Open Full Voice Console</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Sample conversation snippet */}
          <div className="space-y-3 font-sans text-xs">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded bg-indigo-600/30 flex items-center justify-center font-bold text-indigo-300 shrink-0">A</div>
              <div className="bg-slate-800/80 p-3 rounded-2xl text-slate-200 border border-slate-700/60 max-w-lg">
                &quot;Thank you for calling Bright Dental. This is Ava. How may I help you today?&quot;
              </div>
            </div>

            <div className="flex items-start gap-3 justify-end">
              <div className="bg-indigo-600 text-white p-3 rounded-2xl max-w-lg shadow-md shadow-indigo-600/20">
                &quot;Hi Ava, I need to get my teeth cleaned tomorrow afternoon. Do you have anything available?&quot;
              </div>
              <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center font-bold text-slate-300 shrink-0">U</div>
            </div>

            <div className="flex items-center gap-2 pl-9 text-[11px] font-mono text-emerald-400">
              <Zap className="w-3 h-3" />
              <span>Tool Invoked: check_availability(service=&quot;Dental Cleaning&quot;, slot=&quot;tomorrow afternoon&quot;) — 220ms</span>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded bg-indigo-600/30 flex items-center justify-center font-bold text-indigo-300 shrink-0">A</div>
              <div className="bg-slate-800/80 p-3 rounded-2xl text-slate-200 border border-slate-700/60 max-w-lg">
                &quot;We have openings tomorrow at 1:30 PM or 3:00 PM with Dr. Vance. Which of those times works best for you?&quot;
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-16 px-6 max-w-6xl mx-auto space-y-10">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Commercial Architecture Engineered for Real Telephony
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
            Not a generic wrapper. Built from the ground up with voice transport layers, tool gateways, and pgvector RAG.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500/40 transition glass-panel space-y-3"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-white">{feat.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{feat.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Industries */}
      <section id="industries" className="py-16 px-6 max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Pre-Built Industry Templates
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
            Neutral voice engine adapted through verified knowledge guides, specific tool actions, and industry prompts.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {industries.map((ind) => (
            <div
              key={ind.title}
              className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white">{ind.title}</h4>
                {ind.active && (
                  <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                    DEMO READY
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">{ind.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing / Plan Architecture */}
      <section id="pricing" className="py-16 px-6 max-w-6xl mx-auto space-y-10">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Transparent SaaS Plan Architecture
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
            Usage tracking for voice minutes, receptionists, and telephony numbers built into the database.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { name: "Starter", price: "$99", mins: "500 Voice Mins", recs: "1 AI Receptionist" },
            { name: "Professional", price: "$249", mins: "2,000 Voice Mins", recs: "3 AI Receptionists", popular: true },
            { name: "Business", price: "$499", mins: "5,000 Voice Mins", recs: "10 AI Receptionists" },
            { name: "Enterprise", price: "Custom", mins: "Unlimited Mins", recs: "Custom SIP Trunks" },
          ].map((plan) => (
            <div
              key={plan.name}
              className={`p-6 rounded-2xl bg-slate-900/90 border flex flex-col justify-between space-y-4 ${
                plan.popular ? "border-indigo-500 shadow-lg shadow-indigo-500/20" : "border-slate-800"
              }`}
            >
              <div>
                {plan.popular && (
                  <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/20 px-2 py-0.5 rounded uppercase block w-fit mb-2">
                    Most Popular
                  </span>
                )}
                <h3 className="text-base font-bold text-white">{plan.name}</h3>
                <div className="text-3xl font-black text-white mt-2">{plan.price}</div>
                <div className="text-xs text-slate-400 mt-1">per month</div>

                <div className="space-y-2 pt-4 text-xs text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{plan.mins}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{plan.recs}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Post-Call AI Intelligence</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>pgvector RAG Knowledge</span>
                  </div>
                </div>
              </div>

              <Link
                href="/dashboard"
                className={`w-full py-2.5 rounded-xl text-xs font-bold text-center transition ${
                  plan.popular
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-md glow-primary"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-200"
                }`}
              >
                Test in Demo Mode
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-10 px-6 text-center text-xs text-slate-500 space-y-2">
        <div className="flex items-center justify-center gap-2">
          <div className="w-5 h-5 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-[10px]">
            R
          </div>
          <span className="font-bold text-slate-300">ReceptionAI Multi-Tenant SaaS</span>
        </div>
        <p>Production-style AI Voice Receptionist, Telephony Gateway, RAG & Scheduling Platform.</p>
        <p className="text-[10px] text-slate-600">Built for Portfolio & Commercial Production Demonstration.</p>
      </footer>
    </div>
  );
}
