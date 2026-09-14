"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Sparkles,
  Bot,
  Stethoscope,
  Scale,
  Building2,
  Scissors,
  Layers,
  AlertCircle,
} from "lucide-react";
import { Button, Input, Card, cn } from "@receptionai/ui";
import { apiFetch } from "@/lib/api";

interface TemplateOption {
  id: string;
  name: string;
  industry: string;
  roleTitle: string;
  description: string;
  icon: any;
}

const TEMPLATES: TemplateOption[] = [
  {
    id: "DENTAL_RECEPTIONIST",
    name: "Dental Practice",
    industry: "DENTAL",
    roleTitle: "Dental Office Receptionist",
    description: "New patient intake, cleanings, tooth pain triage, and appointment booking.",
    icon: Stethoscope,
  },
  {
    id: "LEGAL_INTAKE",
    name: "Legal Intake Specialist",
    industry: "LEGAL",
    roleTitle: "Legal Intake Specialist",
    description:
      "Screen prospective clients, collect jurisdiction & matter details, route urgent inquiries.",
    icon: Scale,
  },
  {
    id: "GENERAL_RECEPTIONIST",
    name: "General Business",
    industry: "GENERAL",
    roleTitle: "Front Desk Receptionist",
    description:
      "Versatile receptionist for general business inquiries, routing, and message taking.",
    icon: Bot,
  },
  {
    id: "REAL_ESTATE",
    name: "Real Estate Assistant",
    industry: "REAL_ESTATE",
    roleTitle: "Real Estate Assistant",
    description: "Buyer/seller lead capture, showing requests, and on-call agent escalation.",
    icon: Building2,
  },
  {
    id: "SALON",
    name: "Salon & Spa Concierge",
    industry: "SALON",
    roleTitle: "Salon Concierge",
    description:
      "Hair, nail, spa treatment menus, appointment requests, and cancellation policies.",
    icon: Scissors,
  },
  {
    id: "",
    name: "Blank Configuration",
    industry: "GENERAL",
    roleTitle: "Front Desk Receptionist",
    description: "Start from scratch without predefined greetings or instructions.",
    icon: Layers,
  },
];

interface Workspace {
  id: string;
  name: string;
}

export default function NewReceptionistPage() {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("DENTAL_RECEPTIONIST");

  const [name, setName] = useState("Ava");
  const [roleTitle, setRoleTitle] = useState("Dental Office Receptionist");
  const [primaryLanguage, setPrimaryLanguage] = useState("en-US");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Workspace[]>("/api/v1/workspaces")
      .then((ws) => {
        if (ws && ws.length > 0) setWorkspace(ws[0]);
      })
      .catch(() => {});
  }, []);

  function handleSelectTemplate(tpl: TemplateOption) {
    setSelectedTemplate(tpl.id);
    if (tpl.id) {
      setRoleTitle(tpl.roleTitle);
      if (tpl.id === "DENTAL_RECEPTIONIST") setName("Ava");
      else if (tpl.id === "LEGAL_INTAKE") setName("Marcus");
      else if (tpl.id === "GENERAL_RECEPTIONIST") setName("Emma");
      else if (tpl.id === "REAL_ESTATE") setName("Chloe");
      else if (tpl.id === "SALON") setName("Mia");
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!workspace) return;
    if (!name.trim()) {
      setError("Please enter a name for your receptionist.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const selectedTpl = TEMPLATES.find((t) => t.id === selectedTemplate);
      const res = await apiFetch<any>(`/api/v1/workspaces/${workspace.id}/receptionists`, {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          roleTitle: roleTitle.trim() || "Front Desk Receptionist",
          industry: selectedTpl?.industry || "GENERAL",
          primaryLanguage,
          template: selectedTemplate || undefined,
        }),
      });

      router.push(`/receptionists/${res.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to create receptionist.");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Back Button & Header */}
      <div>
        <Link
          href="/receptionists"
          className="inline-flex items-center text-xs text-slate-400 hover:text-white transition mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1" />
          Back to Receptionists
        </Link>

        <h1 className="text-base font-bold text-white tracking-tight">Create AI Receptionist</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Select an industry starter template or configure a custom receptionist from scratch.
        </p>
      </div>

      <form onSubmit={handleCreate} className="space-y-6">
        {/* Template Selector Grid */}
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-slate-300">
            1. Select a Starter Template
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {TEMPLATES.map((tpl) => {
              const Icon = tpl.icon;
              const isSelected = selectedTemplate === tpl.id;
              return (
                <div
                  key={tpl.id}
                  onClick={() => handleSelectTemplate(tpl)}
                  className={cn(
                    "cursor-pointer rounded-xl border p-4 transition text-left flex flex-col justify-between",
                    isSelected
                      ? "bg-indigo-600/10 border-indigo-500 ring-1 ring-indigo-500 shadow-sm"
                      : "bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850"
                  )}
                >
                  <div className="space-y-2">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        isSelected ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">{tpl.name}</h4>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                        {tpl.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Basic Information Card */}
        <Card className="space-y-4">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider text-slate-400">
            2. Basic Identity
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Receptionist Name"
              placeholder="e.g. Ava"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <Input
              label="Role Title"
              placeholder="e.g. Dental Office Receptionist"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              required
            />

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-300">
                Primary Spoken Language
              </label>
              <select
                value={primaryLanguage}
                onChange={(e) => setPrimaryLanguage(e.target.value)}
                className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-white transition focus:outline-none focus:border-indigo-500"
              >
                <option value="en-US">English (US) 🇺🇸</option>
                <option value="en-GB">English (UK) 🇬🇧</option>
                <option value="es-ES">Spanish 🇪🇸</option>
                <option value="fr-FR">French 🇫🇷</option>
                <option value="de-DE">German 🇩🇪</option>
                <option value="it-IT">Italian 🇮🇹</option>
                <option value="pt-BR">Portuguese (Brazil) 🇧🇷</option>
                <option value="ur-PK">Urdu 🇵🇰</option>
              </select>
            </div>
          </div>
        </Card>

        {error && (
          <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-400 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href="/receptionists">
            <Button variant="secondary" size="sm" type="button">
              Cancel
            </Button>
          </Link>
          <Button size="sm" type="submit" isLoading={loading}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Create & Configure
          </Button>
        </div>
      </form>
    </div>
  );
}
