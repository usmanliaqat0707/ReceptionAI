"use client";

import { useState, useEffect } from "react";
import { BookOpen, Search, Sparkles, CheckCircle2, FileText, Globe, Layers, ArrowRight } from "lucide-react";

export default function KnowledgeBasePage() {
  const [sources, setSources] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("Delta Dental insurance coverage");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetch("/api/knowledge")
      .then((res) => res.json())
      .then((data) => {
        if (data.sources) setSources(data.sources);
      })
      .catch(console.error);

    // Initial search
    handleSearch("Delta Dental insurance coverage");
  }, []);

  const handleSearch = async (q: string) => {
    if (!q.trim()) return;
    setSearching(true);
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (data.results) setSearchResults(data.results);
    } catch (e) {
      console.error(e);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">RAG Knowledge Engine</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Clinic documents, policies, FAQs, and pricing indexed with pgvector hybrid search.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Zero Hallucination Grounding</span>
          </span>
        </div>
      </div>

      {/* Sources Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sources.map((src) => (
          <div
            key={src.id}
            className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 glass-panel space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">{src.name}</h3>
                  <p className="text-[11px] text-slate-400">Type: Manual Guide • Verified by Dr. Vance</p>
                </div>
              </div>

              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
                {src.status}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span>Indexed Chunks:</span>
                <span className="font-bold text-slate-200">7 pgvector embeddings</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Assigned Receptionists:</span>
                <span className="font-medium text-indigo-300">Ava (Dental Receptionist)</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Live Hybrid RAG Test Tool */}
      <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 glass-panel space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-indigo-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Test Live Knowledge Retrieval (Vector + Keyword)
            </h3>
          </div>
          <span className="text-[10px] text-slate-400">Simulation of search_knowledge_base tool</span>
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch(searchQuery)}
            placeholder="Search clinic policies, e.g. 'parking location', 'teeth whitening cost'..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
          <button
            onClick={() => handleSearch(searchQuery)}
            disabled={searching}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-2 shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{searching ? "Searching..." : "Test Query"}</span>
          </button>
        </div>

        {/* Sample queries */}
        <div className="flex flex-wrap gap-2 pt-1">
          {["Accepted Insurances", "Routine Cleaning Cost", "Emergency Protocol", "Office Location & Parking"].map((q) => (
            <button
              key={q}
              onClick={() => {
                setSearchQuery(q);
                handleSearch(q);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400 hover:text-white transition"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div className="space-y-3 pt-2">
          {searchResults.map((res, i) => (
            <div key={res.id || i} className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-purple-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-purple-400" />
                  {res.documentTitle}
                </span>
                <span className="text-[10px] font-mono text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                  Similarity: {(res.score * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-slate-300 leading-relaxed text-xs">
                {res.content}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
