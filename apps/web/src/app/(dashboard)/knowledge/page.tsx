"use client";

import React from "react";
import { BookOpen } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export default function KnowledgePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-base font-bold text-white tracking-tight">Knowledge Base & RAG</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Business policies, FAQ guides, pricing lists, and operational documents.
        </p>
      </div>

      <EmptyState
        icon={BookOpen}
        title="No Knowledge Documents Uploaded"
        description="Upload FAQ documents, website links, or clinic policies so your receptionist can ground its answers in verified facts."
        badge="Coming in Phase 2"
      />
    </div>
  );
}
