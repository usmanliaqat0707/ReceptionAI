"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bot,
  Save,
  CheckCircle2,
  AlertCircle,
  Clock,
  PhoneForwarded,
  BookOpen,
  Sparkles,
  Shield,
  Layers,
  History,
  Check,
  AlertTriangle,
  PlayCircle,
  PauseCircle,
  Archive,
  Copy,
  Info,
  Radio,
  ExternalLink,
  RefreshCw,
  Plus,
  Trash2,
  Mic,
} from "lucide-react";
import { Button, Input, Badge, Card, cn } from "@receptionai/ui";
import { apiFetch, ApiException } from "@/lib/api";

interface TransferDestination {
  id: string;
  name: string;
  type: string;
  destination: string;
  maskedDestination: string;
  status: string;
}

interface AssignedTransfer {
  id: string;
  transferDestinationId: string;
  priority: number;
  purpose: "GENERAL" | "SALES" | "SUPPORT" | "EMERGENCY" | "BILLING" | "CUSTOM";
  enabled: boolean;
  maskedDestination: string;
  transferDestination?: TransferDestination;
}

interface ConfigurationSnapshot {
  id: string;
  version: number;
  triggerStatus: string;
  createdAt: string;
  createdByUser?: { name: string; email: string };
  snapshot: any;
}

interface ReadinessEvaluation {
  isComplete: boolean;
  score: number;
  blockingIssues: Array<{ code: string; field: string; message: string }>;
  warnings: Array<{ code: string; message: string }>;
  canEnterTesting: boolean;
  canActivate: boolean;
}

interface ReceptionistDetail {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  roleTitle: string;
  description: string | null;
  industry: string;
  primaryLanguage: string;
  status: "DRAFT" | "TESTING" | "ACTIVE" | "PAUSED" | "ARCHIVED";
  greeting: string | null;
  afterHoursGreeting: string | null;
  instructions: string | null;
  voiceConfig: {
    speakingStyle?: string;
    speakingRate?: string;
    responsePacing?: string;
    provider?: string | null;
    voiceId?: string | null;
  } | null;
  personalityConfig: {
    traits?: string[];
  } | null;
  objectiveConfig: {
    objectives?: string[];
  } | null;
  behaviorConfig: {
    responseLength?: string;
    askOneQuestionAtATime?: boolean;
    confirmCriticalDetails?: boolean;
    allowCallerInterruptions?: boolean;
    silenceHandling?: string;
    silenceTimeoutSeconds?: number;
    unknownAnswerBehavior?: string;
  } | null;
  businessHoursStrategy: "USE_WORKSPACE_HOURS" | "CUSTOM_HOURS" | "ALWAYS_AVAILABLE";
  customHours: any;
  afterHoursConfig: {
    mode?: string;
    useCustomGreeting?: boolean;
  } | null;
  escalationConfig: {
    onHumanRequest?: boolean;
    onEmergency?: boolean;
    onRepeatedFailure?: boolean;
    onUnsupportedRequest?: boolean;
  } | null;
  configurationVersion: number;
  readiness: ReadinessEvaluation;
  runtimeReadiness: string;
  transferDestinations: AssignedTransfer[];
  createdAt: string;
  updatedAt: string;
}

const SECTIONS = [
  { id: "overview", label: "Overview", icon: Bot },
  { id: "identity", label: "Identity", icon: Sparkles },
  { id: "voice", label: "Voice", icon: Radio },
  { id: "personality", label: "Personality", icon: Sparkles },
  { id: "greeting", label: "Greeting", icon: Bot },
  { id: "instructions", label: "Instructions", icon: BookOpen },
  { id: "objectives", label: "Objectives", icon: Layers },
  { id: "behavior", label: "Behavior", icon: Shield },
  { id: "business-hours", label: "Business Hours", icon: Clock },
  { id: "after-hours", label: "After Hours", icon: Clock },
  { id: "escalation", label: "Escalation", icon: AlertTriangle },
  { id: "transfers", label: "Transfers", icon: PhoneForwarded },
  { id: "knowledge", label: "Knowledge", icon: BookOpen },
  { id: "review", label: "Review & Activation", icon: CheckCircle2 },
  { id: "history", label: "Version History", icon: History },
];

const ALL_PERSONALITY_TRAITS = [
  "PROFESSIONAL",
  "FRIENDLY",
  "WARM",
  "CALM",
  "FORMAL",
  "CONCISE",
  "ENERGETIC",
  "PATIENT",
  "EMPATHETIC",
];

const ALL_OBJECTIVES = [
  {
    id: "ANSWER_QUESTIONS",
    title: "Answer Questions",
    desc: "Respond to customer inquiries about services and business info.",
  },
  {
    id: "CAPTURE_LEADS",
    title: "Capture Leads",
    desc: "Gather contact info, caller intent, and prospect requirements.",
    dep: "CRM integration available in later phases",
  },
  {
    id: "BOOK_APPOINTMENTS",
    title: "Book Appointments",
    desc: "Schedule appointments with callers.",
    dep: "Calendar integration required before voice runtime",
  },
  {
    id: "RESCHEDULE_APPOINTMENTS",
    title: "Reschedule Appointments",
    desc: "Modify existing appointment reservations.",
    dep: "Calendar integration required before voice runtime",
  },
  {
    id: "CANCEL_APPOINTMENTS",
    title: "Cancel Appointments",
    desc: "Cancel reservations upon caller request.",
    dep: "Calendar integration required before voice runtime",
  },
  {
    id: "TAKE_MESSAGES",
    title: "Take Messages",
    desc: "Record caller details and message summaries when staff is unavailable.",
  },
  {
    id: "TRANSFER_CALLS",
    title: "Transfer Calls",
    desc: "Route callers to live staff or specialized phone lines.",
    dep: "Requires at least one transfer destination",
  },
  {
    id: "QUALIFY_PROSPECTS",
    title: "Qualify Prospects",
    desc: "Ask screening questions before scheduling or routing.",
  },
  {
    id: "COLLECT_CUSTOMER_INFORMATION",
    title: "Collect Customer Info",
    desc: "Confirm patient/customer phone numbers and account identifiers.",
  },
  {
    id: "HANDLE_AFTER_HOURS",
    title: "Handle After-Hours",
    desc: "Execute specialized triage and message taking outside operating hours.",
  },
];

export default function ReceptionistBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const receptionistId = params.id as string;

  const [activeSection, setActiveSection] = useState("overview");
  const [data, setData] = useState<ReceptionistDetail | null>(null);
  const [workspaceDestinations, setWorkspaceDestinations] = useState<TransferDestination[]>([]);
  const [versionSnapshots, setVersionSnapshots] = useState<ConfigurationSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState("GENERAL");
  const [primaryLanguage, setPrimaryLanguage] = useState("en-US");

  const [speakingStyle, setSpeakingStyle] = useState("professional");
  const [speakingRate, setSpeakingRate] = useState("normal");
  const [responsePacing, setResponsePacing] = useState("balanced");

  const [traits, setTraits] = useState<string[]>([]);
  const [greeting, setGreeting] = useState("");
  const [afterHoursGreeting, setAfterHoursGreeting] = useState("");
  const [instructions, setInstructions] = useState("");

  const [objectives, setObjectives] = useState<string[]>([]);
  const [responseLength, setResponseLength] = useState("balanced");
  const [askOneQuestionAtATime, setAskOneQuestionAtATime] = useState(true);
  const [confirmCriticalDetails, setConfirmCriticalDetails] = useState(true);
  const [allowCallerInterruptions, setAllowCallerInterruptions] = useState(true);
  const [silenceHandling, setSilenceHandling] = useState("PROMPT_ONCE");
  const [unknownAnswerBehavior, setUnknownAnswerBehavior] = useState("take_message");

  const [businessHoursStrategy, setBusinessHoursStrategy] = useState<
    "USE_WORKSPACE_HOURS" | "CUSTOM_HOURS" | "ALWAYS_AVAILABLE"
  >("USE_WORKSPACE_HOURS");
  const [afterHoursMode, setAfterHoursMode] = useState("TAKE_MESSAGE");
  const [useCustomGreeting, setUseCustomGreeting] = useState(false);

  const [onHumanRequest, setOnHumanRequest] = useState(true);
  const [onEmergency, setOnEmergency] = useState(true);
  const [onRepeatedFailure, setOnRepeatedFailure] = useState(true);
  const [onUnsupportedRequest, setOnUnsupportedRequest] = useState(false);

  const [assignedTransfers, setAssignedTransfers] = useState<AssignedTransfer[]>([]);

  // Concurrency Conflict Modal
  const [conflictError, setConflictError] = useState<string | null>(null);

  // Confirmation Modals for Lifecycle Actions
  const [confirmModal, setConfirmModal] = useState<{
    action: "testing" | "activate" | "pause" | "archive" | "duplicate";
    title: string;
    description: string;
  } | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // New Transfer Destination Modal
  const [newDestModal, setNewDestModal] = useState(false);
  const [newDestName, setNewDestName] = useState("");
  const [newDestPhone, setNewDestPhone] = useState("");
  const [newDestError, setNewDestError] = useState<string | null>(null);

  // Knowledge Sources State
  const [workspaceSources, setWorkspaceSources] = useState<any[]>([]);
  const [assignedSourceIds, setAssignedSourceIds] = useState<string[]>([]);
  const [savingKnowledge, setSavingKnowledge] = useState(false);
  const [knowledgeSaveSuccess, setKnowledgeSaveSuccess] = useState(false);

  useEffect(() => {
    loadReceptionist();
  }, [receptionistId]);

  async function loadReceptionist() {
    try {
      setLoading(true);
      setError(null);
      setConflictError(null);

      // 1. Get workspace ID
      const workspaces = await apiFetch<any[]>("/api/v1/workspaces");
      if (!workspaces || workspaces.length === 0) return;

      const storedSlug = typeof window !== "undefined" ? localStorage.getItem("rai_active_ws") : null;
      let targetWs = workspaces.find((w) => w.slug === storedSlug) || workspaces[0];

      let rec: ReceptionistDetail | null = null;
      let wsId = targetWs.id;
      try {
        rec = await apiFetch<ReceptionistDetail>(
          `/api/v1/workspaces/${targetWs.id}/receptionists/${receptionistId}`
        );
      } catch {
        for (const ws of workspaces) {
          if (ws.id === targetWs.id) continue;
          try {
            rec = await apiFetch<ReceptionistDetail>(
              `/api/v1/workspaces/${ws.id}/receptionists/${receptionistId}`
            );
            wsId = ws.id;
            break;
          } catch {
            // try next
          }
        }
      }

      if (!rec) throw new Error("AI receptionist not found in your workspaces.");
      setData(rec);

      // Populate local form states
      setName(rec.name);
      setRoleTitle(rec.roleTitle);
      setDescription(rec.description || "");
      setIndustry(rec.industry);
      setPrimaryLanguage(rec.primaryLanguage);

      const vc = rec.voiceConfig || {};
      setSpeakingStyle(vc.speakingStyle || "professional");
      setSpeakingRate(vc.speakingRate || "normal");
      setResponsePacing(vc.responsePacing || "balanced");

      setTraits(rec.personalityConfig?.traits || []);
      setGreeting(rec.greeting || "");
      setAfterHoursGreeting(rec.afterHoursGreeting || "");
      setInstructions(rec.instructions || "");

      setObjectives(rec.objectiveConfig?.objectives || []);

      const bc = rec.behaviorConfig || {};
      setResponseLength(bc.responseLength || "balanced");
      setAskOneQuestionAtATime(bc.askOneQuestionAtATime ?? true);
      setConfirmCriticalDetails(bc.confirmCriticalDetails ?? true);
      setAllowCallerInterruptions(bc.allowCallerInterruptions ?? true);
      setSilenceHandling(bc.silenceHandling || "PROMPT_ONCE");
      setUnknownAnswerBehavior(bc.unknownAnswerBehavior || "take_message");

      setBusinessHoursStrategy(rec.businessHoursStrategy || "USE_WORKSPACE_HOURS");
      setAfterHoursMode(rec.afterHoursConfig?.mode || "TAKE_MESSAGE");
      setUseCustomGreeting(Boolean(rec.afterHoursConfig?.useCustomGreeting));

      const ec = rec.escalationConfig || {};
      setOnHumanRequest(ec.onHumanRequest ?? true);
      setOnEmergency(ec.onEmergency ?? true);
      setOnRepeatedFailure(ec.onRepeatedFailure ?? true);
      setOnUnsupportedRequest(ec.onUnsupportedRequest ?? false);

      setAssignedTransfers(rec.transferDestinations || []);

      // 3. Fetch workspace transfer destinations
      const destinations = await apiFetch<TransferDestination[]>(
        `/api/v1/workspaces/${wsId}/transfer-destinations`
      );
      setWorkspaceDestinations(destinations || []);

      // 4. Fetch configuration snapshots
      const snapshots = await apiFetch<ConfigurationSnapshot[]>(
        `/api/v1/workspaces/${wsId}/receptionists/${receptionistId}/versions`
      );
      setVersionSnapshots(snapshots || []);

      // 5. Fetch knowledge sources & assignments
      try {
        const [wsSourcesRes, assignedRes] = await Promise.all([
          apiFetch<{ data: any[] }>(`/api/v1/workspaces/${wsId}/knowledge/sources`),
          apiFetch<{ data: any[] }>(
            `/api/v1/workspaces/${wsId}/receptionists/${receptionistId}/knowledge-sources`
          ),
        ]);
        setWorkspaceSources(wsSourcesRes.data || []);
        setAssignedSourceIds(assignedRes.data?.map((s: any) => s.id) || []);
      } catch (kErr) {
        console.warn("Could not load knowledge assignments:", kErr);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load receptionist builder.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!data) return;
    setSaving(true);
    setError(null);
    setConflictError(null);
    setSaveSuccess(false);

    try {
      const payload = {
        name,
        roleTitle,
        description: description || null,
        industry,
        primaryLanguage,
        greeting: greeting || null,
        afterHoursGreeting: afterHoursGreeting || null,
        instructions: instructions || null,
        voiceConfig: {
          speakingStyle,
          speakingRate,
          responsePacing,
        },
        personalityConfig: {
          traits,
        },
        objectiveConfig: {
          objectives,
        },
        behaviorConfig: {
          responseLength,
          askOneQuestionAtATime,
          confirmCriticalDetails,
          allowCallerInterruptions,
          silenceHandling,
          silenceTimeoutSeconds: 8,
          unknownAnswerBehavior,
        },
        businessHoursStrategy,
        afterHoursConfig: {
          mode: afterHoursMode,
          useCustomGreeting,
        },
        escalationConfig: {
          onHumanRequest,
          onEmergency,
          onRepeatedFailure,
          onUnsupportedRequest,
        },
        expectedVersion: data.configurationVersion,
      };

      const res = await apiFetch<{ data: any }>(
        `/api/v1/workspaces/${data.workspaceId}/receptionists/${data.id}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        }
      );

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      loadReceptionist();
    } catch (err: any) {
      if (err.status === 409 || err.error?.code === "CONFIGURATION_VERSION_CONFLICT") {
        setConflictError(
          "This configuration was updated by another session. Please reload to review the latest changes before overwriting."
        );
      } else {
        setError(err.message || "Failed to save configuration.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleExecuteModalAction() {
    if (!data || !confirmModal) return;
    setModalLoading(true);
    setError(null);

    try {
      if (confirmModal.action === "duplicate") {
        const res = await apiFetch<any>(
          `/api/v1/workspaces/${data.workspaceId}/receptionists/${data.id}/duplicate`,
          { method: "POST" }
        );
        setConfirmModal(null);
        router.push(`/receptionists/${res.id}`);
        return;
      }

      await apiFetch(
        `/api/v1/workspaces/${data.workspaceId}/receptionists/${data.id}/${confirmModal.action}`,
        { method: "POST" }
      );

      setConfirmModal(null);
      loadReceptionist();
    } catch (err: any) {
      setError(err.message || "Action failed.");
      setConfirmModal(null);
    } finally {
      setModalLoading(false);
    }
  }

  async function handleCreateDestination(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    setNewDestError(null);

    try {
      const res = await apiFetch<TransferDestination>(
        `/api/v1/workspaces/${data.workspaceId}/transfer-destinations`,
        {
          method: "POST",
          body: JSON.stringify({
            name: newDestName.trim(),
            type: "PHONE",
            destination: newDestPhone.trim(),
          }),
        }
      );

      setWorkspaceDestinations([res, ...workspaceDestinations]);

      // Automatically assign to this receptionist
      const updatedList = [
        ...assignedTransfers,
        {
          id: res.id,
          transferDestinationId: res.id,
          priority: assignedTransfers.length + 1,
          purpose: "GENERAL" as const,
          enabled: true,
          maskedDestination: res.maskedDestination,
          transferDestination: res,
        },
      ];

      await apiFetch(
        `/api/v1/workspaces/${data.workspaceId}/receptionists/${data.id}/transfer-destinations`,
        {
          method: "PUT",
          body: JSON.stringify({
            destinations: updatedList.map((d) => ({
              transferDestinationId: d.transferDestinationId,
              priority: d.priority,
              purpose: d.purpose,
              enabled: d.enabled,
            })),
          }),
        }
      );

      setNewDestModal(false);
      setNewDestName("");
      setNewDestPhone("");
      loadReceptionist();
    } catch (err: any) {
      setNewDestError(err.message || "Failed to create transfer destination.");
    }
  }

  async function handleRemoveTransfer(destId: string) {
    if (!data) return;
    const remaining = assignedTransfers.filter((t) => t.transferDestinationId !== destId);
    try {
      await apiFetch(
        `/api/v1/workspaces/${data.workspaceId}/receptionists/${data.id}/transfer-destinations`,
        {
          method: "PUT",
          body: JSON.stringify({
            destinations: remaining.map((d) => ({
              transferDestinationId: d.transferDestinationId,
              priority: d.priority,
              purpose: d.purpose,
              enabled: d.enabled,
            })),
          }),
        }
      );
      loadReceptionist();
    } catch (err: any) {
      setError(err.message || "Failed to update transfer destinations.");
    }
  }

  function handleToggleKnowledgeSource(sourceId: string) {
    if (assignedSourceIds.includes(sourceId)) {
      setAssignedSourceIds(assignedSourceIds.filter((id) => id !== sourceId));
    } else {
      setAssignedSourceIds([...assignedSourceIds, sourceId]);
    }
  }

  async function handleSaveKnowledgeAssignments() {
    if (!data) return;
    setSavingKnowledge(true);
    try {
      await apiFetch(
        `/api/v1/workspaces/${data.workspaceId}/receptionists/${data.id}/knowledge-sources`,
        {
          method: "PUT",
          body: JSON.stringify({ knowledgeSourceIds: assignedSourceIds }),
        }
      );
      setKnowledgeSaveSuccess(true);
      setTimeout(() => setKnowledgeSaveSuccess(false), 2500);
      loadReceptionist();
    } catch (err: any) {
      setError(err.message || "Failed to update knowledge assignments.");
    } finally {
      setSavingKnowledge(false);
    }
  }

  function getSectionStatus(sectionId: string): "complete" | "attention" | "optional" {
    if (!data) return "optional";
    const readiness = data.readiness;

    if (sectionId === "identity") {
      return name && roleTitle ? "complete" : "attention";
    }
    if (sectionId === "greeting") {
      return greeting && greeting.length >= 10 ? "complete" : "attention";
    }
    if (sectionId === "instructions") {
      return instructions && instructions.length >= 20 ? "complete" : "attention";
    }
    if (sectionId === "objectives") {
      return objectives.length > 0 ? "complete" : "attention";
    }
    if (sectionId === "knowledge") {
      if (objectives.includes("ANSWER_QUESTIONS")) {
        return assignedSourceIds.length > 0 ? "complete" : "attention";
      }
      return assignedSourceIds.length > 0 ? "complete" : "optional";
    }
    if (sectionId === "transfers") {
      if (objectives.includes("TRANSFER_CALLS")) {
        return assignedTransfers.length > 0 ? "complete" : "attention";
      }
      return assignedTransfers.length > 0 ? "complete" : "optional";
    }
    if (sectionId === "after-hours") {
      if (afterHoursMode === "TRANSFER_EMERGENCY") {
        const hasEmerg = assignedTransfers.some((t) => t.purpose === "EMERGENCY");
        return hasEmerg ? "complete" : "attention";
      }
      return "complete";
    }
    if (sectionId === "voice" || sectionId === "personality" || sectionId === "behavior") {
      return "complete";
    }
    return "optional";
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-slate-800 rounded" />
        <div className="h-14 w-full bg-slate-900 border border-slate-800 rounded-xl" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-96 bg-slate-900 rounded-xl" />
          <div className="col-span-3 h-96 bg-slate-900 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="p-12 text-center">
        <AlertCircle className="h-8 w-8 text-rose-500 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-white">Receptionist Not Found</h3>
        <p className="text-xs text-slate-400 mt-1 mb-4">
          The requested AI receptionist does not exist or has been deleted.
        </p>
        <Link href="/receptionists">
          <Button size="sm">Back to Receptionists</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header & Breadcrumbs */}
      <div>
        <Link
          href="/receptionists"
          className="inline-flex items-center text-xs text-slate-400 hover:text-white transition mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1" />
          Back to Receptionists
        </Link>

        {/* Sticky Control Bar */}
        <div className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur-md py-3 border-b border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold">
              {data.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight">{data.name}</h1>
                <Badge
                  variant={
                    data.status === "ACTIVE"
                      ? "success"
                      : data.status === "TESTING"
                        ? "purple"
                        : data.status === "PAUSED"
                          ? "warning"
                          : "default"
                  }
                >
                  {data.status}
                </Badge>
                <span className="text-[11px] font-mono text-slate-500">
                  v{data.configurationVersion}
                </span>
              </div>
              <p className="text-xs text-slate-400">{data.roleTitle}</p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {/* Readiness Indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs">
              <span className="text-slate-400 text-[11px]">Readiness:</span>
              <span
                className={cn(
                  "font-bold font-mono text-[11px]",
                  data.readiness.isComplete ? "text-emerald-400" : "text-amber-400"
                )}
              >
                {data.readiness.score}%
              </span>
            </div>

            {/* Save Button */}
            <Button size="sm" onClick={handleSave} isLoading={saving} className="h-8 text-xs">
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Save Draft
            </Button>

            {/* Test Voice Playground Button */}
            <Link href={`/receptionists/${data.id}/test`}>
              <Button
                size="sm"
                variant="secondary"
                className="h-8 text-xs text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/10 bg-indigo-500/5 font-medium"
              >
                <Mic className="h-3.5 w-3.5 mr-1 text-indigo-400" />
                Test Voice
              </Button>
            </Link>

            {/* Duplicate Button */}
            <Button
              size="sm"
              variant="secondary"
              className="h-8 text-xs"
              onClick={() =>
                setConfirmModal({
                  action: "duplicate",
                  title: "Duplicate Receptionist",
                  description: `Create a new DRAFT copy of ${data.name} with identical conversation configuration.`,
                })
              }
            >
              <Copy className="h-3.5 w-3.5 mr-1" />
              Duplicate
            </Button>

            {/* Lifecycle Action Buttons */}
            {data.status === "DRAFT" && (
              <Button
                size="sm"
                variant="secondary"
                className="h-8 text-xs text-purple-400 border-purple-500/30 hover:bg-purple-500/10"
                onClick={() =>
                  setConfirmModal({
                    action: "testing",
                    title: "Transition to Testing Mode",
                    description:
                      "Mark this receptionist configuration as ready for test-mode inspection. An immutable configuration snapshot will be saved.",
                  })
                }
              >
                <PlayCircle className="h-3.5 w-3.5 mr-1" />
                Move to Testing
              </Button>
            )}

            {(data.status === "DRAFT" || data.status === "TESTING" || data.status === "PAUSED") && (
              <Button
                size="sm"
                variant="secondary"
                className="h-8 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                onClick={() =>
                  setConfirmModal({
                    action: "activate",
                    title: "Activate Receptionist Configuration",
                    description:
                      "Mark this configuration as Active. Note: Realtime voice and telephone call handling remain unavailable in Phase 2.",
                  })
                }
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Activate
              </Button>
            )}

            {data.status === "ACTIVE" && (
              <Button
                size="sm"
                variant="secondary"
                className="h-8 text-xs text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                onClick={() =>
                  setConfirmModal({
                    action: "pause",
                    title: "Pause Receptionist",
                    description:
                      "Pausing this receptionist disables it from live routing once telephony is connected.",
                  })
                }
              >
                <PauseCircle className="h-3.5 w-3.5 mr-1" />
                Pause
              </Button>
            )}

            {data.status !== "ARCHIVED" && (
              <Button
                size="sm"
                variant="secondary"
                className="h-8 text-xs text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
                onClick={() =>
                  setConfirmModal({
                    action: "archive",
                    title: "Archive Receptionist",
                    description:
                      "Archive this receptionist configuration. It will become read-only and hidden from active lists.",
                  })
                }
              >
                <Archive className="h-3.5 w-3.5 mr-1" />
                Archive
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {saveSuccess && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-xs text-emerald-400 flex items-center gap-2">
          <Check className="h-4 w-4 shrink-0" />
          <span>Configuration draft saved successfully (Version incremented).</span>
        </div>
      )}

      {/* Version Conflict Alert */}
      {conflictError && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-300 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-200">Configuration Version Conflict (409)</p>
              <p className="mt-0.5">{conflictError}</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={loadReceptionist}
            className="shrink-0 h-7 text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1" /> Reload Latest
          </Button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Builder Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Left Navigation Sidebar */}
        <div className="space-y-1">
          <p className="px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Builder Sections
          </p>

          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const status = getSectionStatus(sec.id);
            const isActive = activeSection === sec.id;

            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition text-left",
                  isActive
                    ? "bg-indigo-600/15 text-indigo-400 font-semibold border border-indigo-500/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="h-3.5 w-3.5" />
                  <span>{sec.label}</span>
                </div>

                {status === "complete" && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                {status === "attention" && <AlertCircle className="h-3.5 w-3.5 text-amber-400" />}
                {status === "optional" && (
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />
                )}
              </button>
            );
          })}
        </div>

        {/* Right Configuration Panels */}
        <div className="md:col-span-3 space-y-6">
          {/* 1. OVERVIEW SECTION */}
          {activeSection === "overview" && (
            <Card className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-white">Receptionist Summary</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  General status and conversation readiness overview.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg">
                  <p className="text-[11px] text-slate-500 font-medium">Configuration Status</p>
                  <p className="text-sm font-bold text-white mt-1">{data.status}</p>
                </div>

                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg">
                  <p className="text-[11px] text-slate-500 font-medium">Readiness Score</p>
                  <p className="text-sm font-bold text-emerald-400 mt-1">{data.readiness.score}%</p>
                </div>

                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg">
                  <p className="text-[11px] text-slate-500 font-medium">Runtime Status</p>
                  <p className="text-sm font-bold text-amber-400 mt-1">Unavailable (Phase 2)</p>
                </div>
              </div>

              {/* Phase 2 Architecture Notice */}
              <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Radio className="h-4 w-4 text-indigo-400" />
                  <span>Realtime Voice Telephony Boundary</span>
                </div>
                <p className="text-xs text-indigo-300/90 leading-relaxed">
                  Phase 2 stores, validates, and manages the complete AI receptionist configuration
                  domain. Realtime WebRTC audio streaming, SIP trunks, phone number provisioning,
                  and live OpenAI Realtime execution will be attached in <strong>Phase 3</strong>.
                </p>
              </div>
            </Card>
          )}

          {/* 2. IDENTITY SECTION */}
          {activeSection === "identity" && (
            <Card className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white">Receptionist Identity</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Define the name, role title, and language your receptionist uses when answering
                  callers.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Receptionist Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ava"
                  required
                />

                <Input
                  label="Role Title"
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  placeholder="e.g. Dental Office Receptionist"
                  required
                />

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">Industry</label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-white"
                  >
                    <option value="GENERAL">General Business</option>
                    <option value="DENTAL">Dental</option>
                    <option value="MEDICAL">Medical & Health</option>
                    <option value="LEGAL">Legal Services</option>
                    <option value="REAL_ESTATE">Real Estate</option>
                    <option value="SALON">Salon & Spa</option>
                    <option value="HOME_SERVICES">Home Services</option>
                    <option value="AUTO_REPAIR">Auto Repair</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Primary Language
                  </label>
                  <select
                    value={primaryLanguage}
                    onChange={(e) => setPrimaryLanguage(e.target.value)}
                    className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-white"
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

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300">
                  Internal Description (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg bg-slate-900 border border-slate-800 p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                  placeholder="Notes for your workspace team regarding this receptionist's purpose..."
                />
              </div>
            </Card>
          )}

          {/* 3. VOICE SECTION */}
          {activeSection === "voice" && (
            <Card className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-white">Voice & Speech Style</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure speaking style, speech pacing, and cadence preferences.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Speaking Style
                  </label>
                  <select
                    value={speakingStyle}
                    onChange={(e) => setSpeakingStyle(e.target.value)}
                    className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-white"
                  >
                    <option value="professional">Professional</option>
                    <option value="warm">Warm & Welcoming</option>
                    <option value="calm">Calm & Soothing</option>
                    <option value="energetic">Energetic & Upbeat</option>
                    <option value="neutral">Neutral</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Speaking Rate
                  </label>
                  <select
                    value={speakingRate}
                    onChange={(e) => setSpeakingRate(e.target.value)}
                    className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-white"
                  >
                    <option value="slow">Slow & Clear</option>
                    <option value="normal">Normal (Recommended)</option>
                    <option value="fast">Fast</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Response Pacing
                  </label>
                  <select
                    value={responsePacing}
                    onChange={(e) => setResponsePacing(e.target.value)}
                    className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-white"
                  >
                    <option value="concise">Concise (Direct answers)</option>
                    <option value="balanced">Balanced</option>
                    <option value="detailed">Detailed</option>
                  </select>
                </div>
              </div>

              <div className="rounded-lg bg-slate-850 border border-slate-800 p-3 text-xs text-slate-400 flex items-center gap-2.5">
                <Info className="h-4 w-4 text-indigo-400 shrink-0" />
                <span>
                  Provider audio models (OpenAI Realtime voice profiles) will be connected and
                  selectable during Phase 3.
                </span>
              </div>
            </Card>
          )}

          {/* 4. PERSONALITY SECTION */}
          {activeSection === "personality" && (
            <Card className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white">Personality Traits</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select up to 6 traits that define your receptionist’s communication demeanor.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {ALL_PERSONALITY_TRAITS.map((t) => {
                  const isSelected = traits.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setTraits(traits.filter((item) => item !== t));
                        } else if (traits.length < 6) {
                          setTraits([...traits, t]);
                        }
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-semibold transition border",
                        isSelected
                          ? "bg-indigo-600 text-white border-indigo-500 shadow-xs"
                          : "bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700"
                      )}
                    >
                      {isSelected ? "✓ " : "+ "}
                      {t.charAt(0) + t.slice(1).toLowerCase()}
                    </button>
                  );
                })}
              </div>

              <p className="text-[11px] text-slate-500">Selected: {traits.length} of 6 traits.</p>
            </Card>
          )}

          {/* 5. GREETING SECTION */}
          {activeSection === "greeting" && (
            <Card className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-white">Call Greetings</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  First impressions spoken to callers upon connection.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    Business-Hours Greeting <span className="text-rose-400">*</span>
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {greeting.length}/600
                  </span>
                </div>
                <textarea
                  value={greeting}
                  onChange={(e) => setGreeting(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg bg-slate-900 border border-slate-800 p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                  placeholder="Thank you for calling Bright Dental. This is Ava. How may I help you today?"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    After-Hours Greeting (Optional)
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {afterHoursGreeting.length}/600
                  </span>
                </div>
                <textarea
                  value={afterHoursGreeting}
                  onChange={(e) => setAfterHoursGreeting(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg bg-slate-900 border border-slate-800 p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                  placeholder="Thank you for calling. Our office is currently closed, but I can still answer common questions and take a message..."
                />
              </div>
            </Card>
          )}

          {/* 6. INSTRUCTIONS SECTION */}
          {activeSection === "instructions" && (
            <Card className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white">System Instructions</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Author specific guidelines, dos, don&apos;ts, and business rules. Platform safety
                  rules take precedence.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    Custom Receptionist Prompt Instructions
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {instructions.length}/8000
                  </span>
                </div>
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={14}
                  className="w-full rounded-lg bg-slate-950 font-mono border border-slate-800 p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 leading-relaxed"
                  placeholder="You are Ava, the receptionist for Bright Dental..."
                />
              </div>
            </Card>
          )}

          {/* 7. OBJECTIVES SECTION */}
          {activeSection === "objectives" && (
            <Card className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white">Operational Objectives</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select which capabilities this receptionist is authorized to handle during calls.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {ALL_OBJECTIVES.map((obj) => {
                  const isEnabled = objectives.includes(obj.id);
                  return (
                    <div
                      key={obj.id}
                      onClick={() => {
                        if (isEnabled) {
                          setObjectives(objectives.filter((o) => o !== obj.id));
                        } else {
                          setObjectives([...objectives, obj.id]);
                        }
                      }}
                      className={cn(
                        "cursor-pointer p-3.5 rounded-xl border transition flex items-start gap-3",
                        isEnabled
                          ? "bg-indigo-600/10 border-indigo-500/50"
                          : "bg-slate-900 border-slate-800 hover:border-slate-700"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => {}}
                        className="mt-1 rounded bg-slate-800 border-slate-700 text-indigo-600"
                      />
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-white">{obj.title}</p>
                        <p className="text-[11px] text-slate-400 leading-relaxed">{obj.desc}</p>
                        {obj.dep && (
                          <p className="text-[10px] text-amber-400 font-medium">⚠️ {obj.dep}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* 8. BEHAVIOR SECTION */}
          {activeSection === "behavior" && (
            <Card className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-white">Conversation Behavior</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Control pacing, caller barge-in interruptions, and silence triage.
                </p>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-white">
                  <input
                    type="checkbox"
                    checked={allowCallerInterruptions}
                    onChange={(e) => setAllowCallerInterruptions(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-indigo-600"
                  />
                  <span>Allow caller barge-in interruptions (Default: true)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-white">
                  <input
                    type="checkbox"
                    checked={askOneQuestionAtATime}
                    onChange={(e) => setAskOneQuestionAtATime(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-indigo-600"
                  />
                  <span>Ask only one question at a time to prevent caller confusion</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-white">
                  <input
                    type="checkbox"
                    checked={confirmCriticalDetails}
                    onChange={(e) => setConfirmCriticalDetails(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-indigo-600"
                  />
                  <span>
                    Always confirm critical details (e.g. phone numbers, appointment dates)
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Silence Handling
                  </label>
                  <select
                    value={silenceHandling}
                    onChange={(e) => setSilenceHandling(e.target.value)}
                    className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-white"
                  >
                    <option value="PROMPT_ONCE">
                      Prompt Once (&quot;Are you still there?&quot;)
                    </option>
                    <option value="PROMPT_TWICE">Prompt Twice</option>
                    <option value="WAIT">Wait Patiently</option>
                    <option value="END_AFTER_PROMPT">End Call After Prompting</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Unknown Answer Behavior
                  </label>
                  <select
                    value={unknownAnswerBehavior}
                    onChange={(e) => setUnknownAnswerBehavior(e.target.value)}
                    className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-white"
                  >
                    <option value="take_message">Offer to take a message (Recommended)</option>
                    <option value="escalate">Escalate/transfer immediately</option>
                    <option value="admit_unknown">Admit unknown and ask follow-up</option>
                  </select>
                </div>
              </div>
            </Card>
          )}

          {/* 9. BUSINESS HOURS SECTION */}
          {activeSection === "business-hours" && (
            <Card className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white">Business Hours Strategy</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Determine operating schedules that trigger after-hours routing.
                </p>
              </div>

              <div className="space-y-2">
                {[
                  {
                    id: "USE_WORKSPACE_HOURS",
                    title: "Use Workspace Schedule (Recommended)",
                    desc: "Follow the master business hours set in Workspace Settings (Mon-Fri 9AM-5PM).",
                  },
                  {
                    id: "ALWAYS_AVAILABLE",
                    title: "Always Available (24/7 Normal Operations)",
                    desc: "Never trigger after-hours mode; answer all incoming calls with standard greeting.",
                  },
                ].map((strategy) => (
                  <label
                    key={strategy.id}
                    className={cn(
                      "flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition",
                      businessHoursStrategy === strategy.id
                        ? "bg-indigo-600/10 border-indigo-500/50"
                        : "bg-slate-900 border-slate-800 hover:border-slate-700"
                    )}
                  >
                    <input
                      type="radio"
                      name="strategy"
                      checked={businessHoursStrategy === strategy.id}
                      onChange={() => setBusinessHoursStrategy(strategy.id as any)}
                      className="mt-1 text-indigo-600"
                    />
                    <div>
                      <p className="text-xs font-bold text-white">{strategy.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{strategy.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </Card>
          )}

          {/* 10. AFTER HOURS SECTION */}
          {activeSection === "after-hours" && (
            <Card className="space-y-5">
              <div>
                <h3 className="text-sm font-bold text-white">After-Hours Handling</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure behavior when a call arrives outside operating hours.
                </p>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300">
                  After-Hours Mode
                </label>
                <select
                  value={afterHoursMode}
                  onChange={(e) => setAfterHoursMode(e.target.value)}
                  className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-white"
                >
                  <option value="TAKE_MESSAGE">Take a Message (Recommended)</option>
                  <option value="FAQ_ONLY">FAQ Questions Only (No booking)</option>
                  <option value="CALLBACK_REQUEST">Capture Callback Request</option>
                  <option value="TRANSFER_EMERGENCY">Transfer to Emergency Line</option>
                  <option value="CONTINUE_NORMAL">Continue Normal Operation</option>
                  <option value="DISABLED">Play closed notice and disconnect</option>
                </select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer text-xs text-white">
                <input
                  type="checkbox"
                  checked={useCustomGreeting}
                  onChange={(e) => setUseCustomGreeting(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-indigo-600"
                />
                <span>Use custom after-hours greeting text</span>
              </label>
            </Card>
          )}

          {/* 11. ESCALATION SECTION */}
          {activeSection === "escalation" && (
            <Card className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white">Call Escalation Rules</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure when the receptionist should immediately offer a human transfer.
                </p>
              </div>

              <div className="space-y-3 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-white">
                  <input
                    type="checkbox"
                    checked={onHumanRequest}
                    onChange={(e) => setOnHumanRequest(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-indigo-600"
                  />
                  <span>Escalate when caller explicitly asks for a human / representative</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-white">
                  <input
                    type="checkbox"
                    checked={onEmergency}
                    onChange={(e) => setOnEmergency(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-indigo-600"
                  />
                  <span>Escalate immediately upon emergency keywords or urgent trauma intent</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-white">
                  <input
                    type="checkbox"
                    checked={onRepeatedFailure}
                    onChange={(e) => setOnRepeatedFailure(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-indigo-600"
                  />
                  <span>
                    Escalate if receptionist fails to understand caller after 2 consecutive tries
                  </span>
                </label>
              </div>
            </Card>
          )}

          {/* 12. TRANSFERS SECTION */}
          {activeSection === "transfers" && (
            <Card className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Transfer Destinations</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Authorized destinations for live call transfers.
                  </p>
                </div>

                <Button size="sm" onClick={() => setNewDestModal(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Destination
                </Button>
              </div>

              {assignedTransfers.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl">
                  <PhoneForwarded className="h-6 w-6 text-slate-500 mx-auto mb-2" />
                  <p className="text-xs text-slate-300 font-semibold">
                    No Transfer Destinations Assigned
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 mb-3">
                    Assign a phone number to allow live caller transfers.
                  </p>
                  <Button size="sm" variant="secondary" onClick={() => setNewDestModal(true)}>
                    Add Destination
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
                  {assignedTransfers.map((t) => (
                    <div
                      key={t.id}
                      className="p-3.5 flex items-center justify-between bg-slate-900/60"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">
                            {t.transferDestination?.name || "Destination"}
                          </span>
                          <Badge variant="purple">{t.purpose}</Badge>
                        </div>
                        <p className="text-[11px] font-mono text-slate-400">
                          {t.maskedDestination || t.transferDestination?.destination}
                        </p>
                      </div>

                      <button
                        onClick={() => handleRemoveTransfer(t.transferDestinationId)}
                        className="p-1 text-slate-400 hover:text-rose-400 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* 13. KNOWLEDGE SECTION */}
          {activeSection === "knowledge" && (
            <Card className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-indigo-400" />
                    <span>Approved Knowledge Sources</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Assign workspace knowledge sources that this receptionist is authorized to search during voice calls.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href="/knowledge"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition"
                  >
                    <span>Manage Knowledge Base</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                  <Button
                    size="sm"
                    onClick={handleSaveKnowledgeAssignments}
                    disabled={savingKnowledge}
                    className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
                  >
                    {savingKnowledge ? "Saving..." : "Save Assignments"}
                  </Button>
                </div>
              </div>

              {knowledgeSaveSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-xs text-emerald-400">
                  <Check className="h-4 w-4 shrink-0" />
                  <span>Knowledge assignments successfully saved!</span>
                </div>
              )}

              {objectives.includes("ANSWER_QUESTIONS") && assignedSourceIds.length === 0 && (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-xl flex items-start gap-2.5 text-xs text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">No Knowledge Sources Assigned</span>
                    <span className="text-amber-300/80 mt-0.5 block">
                      This receptionist has the &quot;Answer Questions&quot; objective enabled, but no knowledge sources are assigned. The receptionist will only be able to answer questions using basic company profile details.
                    </span>
                  </div>
                </div>
              )}

              {workspaceSources.length === 0 ? (
                <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-xl space-y-3">
                  <BookOpen className="h-8 w-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">
                    No approved knowledge sources exist in this workspace yet.
                  </p>
                  <Link
                    href="/knowledge"
                    className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                  >
                    <span>Upload your first document or website</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1">
                    Available Knowledge Sources ({workspaceSources.length})
                  </div>
                  <div className="divide-y divide-slate-800/60 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                    {workspaceSources.map((src) => {
                      const isAssigned = assignedSourceIds.includes(src.id);
                      const isReady = src.status === "READY";

                      return (
                        <div
                          key={src.id}
                          onClick={() => isReady && handleToggleKnowledgeSource(src.id)}
                          className={`p-3.5 flex items-center justify-between transition-colors ${
                            !isReady
                              ? "opacity-60 cursor-not-allowed bg-slate-900/30"
                              : "cursor-pointer hover:bg-slate-900/60"
                          } ${isAssigned ? "bg-indigo-950/20" : ""}`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              disabled={!isReady}
                              checked={isAssigned}
                              onChange={() => isReady && handleToggleKnowledgeSource(src.id)}
                              className="mt-1 rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                            />
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white">{src.name}</span>
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                                  {src.type}
                                </span>
                                <span
                                  className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium uppercase ${
                                    isReady
                                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                      : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                  }`}
                                >
                                  {src.status}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 max-w-lg truncate">
                                {src.sourceUrl || src.description || "No external URL"}
                              </p>
                              <div className="flex items-center gap-2 text-[10px] text-slate-500 pt-0.5">
                                <span>{src.documentCount} docs</span>
                                <span>•</span>
                                <span>{src.chunkCount} chunks</span>
                                <span>•</span>
                                <span>Model: {src.embeddingModel}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <span
                              className={`text-[11px] font-medium ${
                                isAssigned ? "text-indigo-400 font-semibold" : "text-slate-500"
                              }`}
                            >
                              {isAssigned ? "Assigned" : "Unassigned"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* 14. REVIEW SECTION */}
          {activeSection === "review" && (
            <Card className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-white">Readiness Review</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Inspect completeness checks before moving to Testing or Active mode.
                </p>
              </div>

              {/* Blocking Issues */}
              {data.readiness.blockingIssues.length > 0 ? (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-400">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>Blocking Issues ({data.readiness.blockingIssues.length})</span>
                  </div>
                  <ul className="list-disc list-inside text-xs text-rose-300 space-y-1">
                    {data.readiness.blockingIssues.map((issue, idx) => (
                      <li key={idx}>{issue.message}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-400 font-semibold">
                  <Check className="h-4 w-4 shrink-0" />
                  <span>Configuration is 100% complete! No blocking issues found.</span>
                </div>
              )}

              {/* Warnings */}
              {data.readiness.warnings.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Future Integration Notices ({data.readiness.warnings.length})</span>
                  </div>
                  <ul className="list-disc list-inside text-xs text-amber-300 space-y-1">
                    {data.readiness.warnings.map((w, idx) => (
                      <li key={idx}>{w.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}

          {/* 15. HISTORY SECTION */}
          {activeSection === "history" && (
            <Card className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white">Configuration History & Snapshots</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Immutable snapshots recorded whenever this receptionist transitioned to Testing or
                  Active.
                </p>
              </div>

              {versionSnapshots.length === 0 ? (
                <p className="text-xs text-slate-500 py-4">No snapshots recorded yet.</p>
              ) : (
                <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
                  {versionSnapshots.map((snap) => (
                    <div key={snap.id} className="p-3.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white font-mono">v{snap.version}</span>
                          <Badge variant="purple">{snap.triggerStatus}</Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Created on {new Date(snap.createdAt).toLocaleString()}
                        </p>
                      </div>

                      <span className="text-[10px] font-mono text-slate-500">Immutable</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Action Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white">{confirmModal.title}</h3>
            <p className="text-xs text-slate-300 leading-relaxed">{confirmModal.description}</p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfirmModal(null)}
                disabled={modalLoading}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleExecuteModalAction} isLoading={modalLoading}>
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* New Transfer Destination Modal */}
      {newDestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form
            onSubmit={handleCreateDestination}
            className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl"
          >
            <h3 className="text-sm font-bold text-white">Add Transfer Destination</h3>
            <Input
              label="Destination Name"
              placeholder="e.g. Front Desk Human"
              value={newDestName}
              onChange={(e) => setNewDestName(e.target.value)}
              required
            />
            <Input
              label="E.164 Phone Number"
              placeholder="+15555550100"
              value={newDestPhone}
              onChange={(e) => setNewDestPhone(e.target.value)}
              required
            />
            {newDestError && <p className="text-xs text-rose-400">{newDestError}</p>}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setNewDestModal(false)}
              >
                Cancel
              </Button>
              <Button size="sm" type="submit">
                Save & Assign
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
