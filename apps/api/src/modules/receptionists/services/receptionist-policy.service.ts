import {
  Receptionist,
  ReceptionistStatus,
  ReceptionistTransferDestination,
  TransferDestination,
} from "@receptionai/db";

export interface BlockingIssue {
  code: string;
  field: string;
  message: string;
}

export interface ReadinessWarning {
  code: string;
  message: string;
}

export interface ReadinessEvaluation {
  isComplete: boolean;
  score: number;
  blockingIssues: BlockingIssue[];
  warnings: ReadinessWarning[];
  canEnterTesting: boolean;
  canActivate: boolean;
}

export type RuntimeReadiness =
  | "NOT_CONFIGURED"
  | "DEPENDENCIES_MISSING"
  | "CONFIGURED_RUNTIME_UNAVAILABLE"
  | "BROWSER_TEST_AVAILABLE";

export interface DetailedRuntimeReadiness {
  browserTest: "READY" | "INCOMPLETE" | "UNAVAILABLE";
  browserVoice: "READY" | "INCOMPLETE";
  businessTools: {
    contacts: "READY" | "DISABLED";
    leads: "READY" | "DISABLED";
    messages: "READY" | "DISABLED";
    appointments: "READY" | "DISABLED";
    knowledge: "READY" | "DISABLED";
    telephony: "NOT_IMPLEMENTED";
  };
  productionVoice: "NOT_IMPLEMENTED";
  telephony: "NOT_IMPLEMENTED";
}

export class ReceptionistPolicyService {
  /**
   * Validates whether a requested status transition is allowed by domain rules.
   */
  static canTransitionStatus(
    currentStatus: ReceptionistStatus,
    targetStatus: ReceptionistStatus
  ): boolean {
    if (currentStatus === targetStatus) return true;

    const allowedTransitions: Record<ReceptionistStatus, ReceptionistStatus[]> = {
      DRAFT: ["TESTING", "ARCHIVED"],
      TESTING: ["DRAFT", "ACTIVE", "ARCHIVED"],
      ACTIVE: ["PAUSED", "ARCHIVED"],
      PAUSED: ["ACTIVE", "ARCHIVED"],
      ARCHIVED: [], // Archived records are read-only historical snapshots
    };

    return allowedTransitions[currentStatus]?.includes(targetStatus) ?? false;
  }

  /**
   * Evaluates configuration completeness, blocking validation issues, and future runtime warnings.
   */
  static evaluateReadiness(
    receptionist: Receptionist,
    transferDestinations: Array<
      ReceptionistTransferDestination & { transferDestination?: TransferDestination | null }
    > = []
  ): ReadinessEvaluation {
    const blockingIssues: BlockingIssue[] = [];
    const warnings: ReadinessWarning[] = [];
    let score = 0;

    // 1. Identity validation (25 points)
    if (!receptionist.name || receptionist.name.trim().length < 2) {
      blockingIssues.push({
        code: "NAME_REQUIRED",
        field: "name",
        message: "Receptionist name must be at least 2 characters long.",
      });
    } else {
      score += 10;
    }

    if (!receptionist.roleTitle || receptionist.roleTitle.trim().length < 2) {
      blockingIssues.push({
        code: "ROLE_TITLE_REQUIRED",
        field: "roleTitle",
        message: "A descriptive role title (e.g. 'Dental Office Receptionist') is required.",
      });
    } else {
      score += 10;
    }

    if (receptionist.primaryLanguage) {
      score += 5;
    }

    // 2. Greeting validation (20 points)
    if (!receptionist.greeting || receptionist.greeting.trim().length < 10) {
      blockingIssues.push({
        code: "GREETING_REQUIRED",
        field: "greeting",
        message: "A business-hours greeting of at least 10 characters is required.",
      });
    } else {
      score += 20;
    }

    // 3. Instructions validation (20 points)
    if (!receptionist.instructions || receptionist.instructions.trim().length < 20) {
      blockingIssues.push({
        code: "INSTRUCTIONS_REQUIRED",
        field: "instructions",
        message: "Receptionist instructions of at least 20 characters are required.",
      });
    } else {
      score += 20;
    }

    // 4. Voice and Personality (15 points)
    const voiceConfig = (receptionist.voiceConfig as Record<string, any>) || {};
    if (voiceConfig.speakingStyle) score += 5;

    const personalityConfig = (receptionist.personalityConfig as { traits?: string[] }) || {};
    if (Array.isArray(personalityConfig.traits) && personalityConfig.traits.length > 0) {
      score += 10;
    } else {
      warnings.push({
        code: "NO_PERSONALITY_TRAITS",
        message: "No personality traits selected; receptionist will use default neutral tone.",
      });
    }

    // 5. Objectives & Dependency validation (20 points)
    const objectiveConfig = (receptionist.objectiveConfig as { objectives?: string[] }) || {};
    const objectives = Array.isArray(objectiveConfig.objectives) ? objectiveConfig.objectives : [];

    if (objectives.length > 0) {
      score += 20;
    } else {
      blockingIssues.push({
        code: "OBJECTIVES_REQUIRED",
        field: "objectives",
        message: "At least one operational objective must be enabled.",
      });
    }

    // Objective Dependency: TRANSFER_CALLS requires at least one active transfer destination
    const activeDestinations = transferDestinations.filter(
      (d) => d.enabled && d.transferDestination && d.transferDestination.status === "ACTIVE"
    );

    if (objectives.includes("TRANSFER_CALLS")) {
      if (activeDestinations.length === 0) {
        blockingIssues.push({
          code: "TRANSFER_DESTINATION_REQUIRED",
          field: "transfers",
          message:
            "The 'Transfer Calls' objective is enabled, but no active transfer destinations are assigned.",
        });
      }
    }

    // After-Hours Emergency Dependency
    const afterHoursConfig =
      (receptionist.afterHoursConfig as { mode?: string; useCustomGreeting?: boolean }) || {};
    if (afterHoursConfig.mode === "TRANSFER_EMERGENCY") {
      const emergencyDestination = activeDestinations.find((d) => d.purpose === "EMERGENCY");
      if (!emergencyDestination) {
        blockingIssues.push({
          code: "EMERGENCY_TRANSFER_DESTINATION_REQUIRED",
          field: "afterHours",
          message:
            "After-hours emergency transfer mode is selected, but no transfer destination with 'EMERGENCY' purpose is assigned.",
        });
      }
    }

    if (
      afterHoursConfig.useCustomGreeting &&
      (!receptionist.afterHoursGreeting || receptionist.afterHoursGreeting.trim().length < 5)
    ) {
      warnings.push({
        code: "AFTER_HOURS_GREETING_RECOMMENDED",
        message: "Custom after-hours greeting is enabled, but no custom greeting text is provided.",
      });
    }

    // Future runtime integration warnings (do not block configuration, but inform the user)
    if (
      objectives.includes("BOOK_APPOINTMENTS") ||
      objectives.includes("RESCHEDULE_APPOINTMENTS") ||
      objectives.includes("CANCEL_APPOINTMENTS")
    ) {
      warnings.push({
        code: "CALENDAR_INTEGRATION_REQUIRED",
        message:
          "Calendar integration (Google/Outlook) required before production voice appointment booking.",
      });
    }

    if (objectives.includes("CAPTURE_LEADS")) {
      warnings.push({
        code: "CRM_INTEGRATION_RECOMMENDED",
        message:
          "External CRM webhook or integration will be required for automated lead exports in later phases.",
      });
    }

    const isComplete = blockingIssues.length === 0;
    const canEnterTesting = isComplete;
    const canActivate = isComplete;

    return {
      isComplete,
      score: Math.min(100, score),
      blockingIssues,
      warnings,
      canEnterTesting,
      canActivate,
    };
  }

  /**
   * Derived runtime readiness concept. In Phase 3, browser voice testing is available,
   * while production telephony and incoming phone lines remain not implemented.
   */
  static getRuntimeReadiness(receptionist: Receptionist): RuntimeReadiness {
    if (receptionist.status === "DRAFT") {
      return "NOT_CONFIGURED";
    }

    return "BROWSER_TEST_AVAILABLE";
  }

  static getDetailedRuntimeReadiness(
    receptionist: Receptionist,
    readiness?: ReadinessEvaluation
  ): DetailedRuntimeReadiness {
    const isReadyForTesting = readiness
      ? readiness.canEnterTesting
      : receptionist.status !== "DRAFT";

    const objectiveConfig =
      (receptionist.objectiveConfig as { objectives?: string[] }) || {};
    const objectives = objectiveConfig.objectives || [];

    const hasContacts =
      objectives.includes("COLLECT_CUSTOMER_INFORMATION") ||
      objectives.includes("CAPTURE_LEADS");
    const hasLeads = objectives.includes("CAPTURE_LEADS");
    const hasMessages =
      objectives.includes("TAKE_MESSAGES") ||
      objectives.includes("HANDLE_AFTER_HOURS");

    return {
      browserTest: isReadyForTesting ? "READY" : "INCOMPLETE",
      browserVoice: isReadyForTesting ? "READY" : "INCOMPLETE",
      businessTools: {
        contacts: hasContacts ? "READY" : "DISABLED",
        leads: hasLeads ? "READY" : "DISABLED",
        messages: hasMessages ? "READY" : "DISABLED",
        knowledge: objectives.includes("ANSWER_QUESTIONS") ? "READY" : "DISABLED",
        appointments:
          objectives.includes("SCHEDULE_APPOINTMENTS") ||
          objectives.includes("BOOK_APPOINTMENTS")
            ? "READY"
            : "DISABLED",
        telephony: "NOT_IMPLEMENTED",
      },
      productionVoice: "NOT_IMPLEMENTED",
      telephony: "NOT_IMPLEMENTED",
    };
  }

  /**
   * Compiles an immutable validated JSON snapshot for storage in ReceptionistConfigurationVersion.
   */
  static createConfigurationSnapshot(
    receptionist: Receptionist,
    transferDestinations: Array<
      ReceptionistTransferDestination & { transferDestination?: TransferDestination | null }
    > = []
  ): Record<string, any> {
    return {
      version: receptionist.configurationVersion,
      identity: {
        id: receptionist.id,
        workspaceId: receptionist.workspaceId,
        name: receptionist.name,
        slug: receptionist.slug,
        description: receptionist.description,
        roleTitle: receptionist.roleTitle,
        industry: receptionist.industry,
        primaryLanguage: receptionist.primaryLanguage,
      },
      voice: receptionist.voiceConfig || {},
      personality: receptionist.personalityConfig || { traits: [] },
      greeting: {
        businessHours: receptionist.greeting,
        afterHours: receptionist.afterHoursGreeting,
      },
      instructions: receptionist.instructions || "",
      objectives: receptionist.objectiveConfig || { objectives: [] },
      behavior: receptionist.behaviorConfig || {},
      businessHours: {
        strategy: receptionist.businessHoursStrategy,
        customHours: receptionist.customHours || null,
      },
      afterHours: receptionist.afterHoursConfig || {},
      escalation: receptionist.escalationConfig || {},
      transfers: transferDestinations.map((td) => ({
        id: td.id,
        transferDestinationId: td.transferDestinationId,
        name: td.transferDestination?.name || "Unknown",
        type: td.transferDestination?.type || "PHONE",
        destination: td.transferDestination?.destination || "",
        priority: td.priority,
        purpose: td.purpose,
        enabled: td.enabled,
      })),
      snapshotCreatedAt: new Date().toISOString(),
    };
  }
}
