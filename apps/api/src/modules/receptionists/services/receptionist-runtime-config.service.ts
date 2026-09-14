import {
  Receptionist,
  ReceptionistTransferDestination,
  TransferDestination,
} from "@receptionai/db";
import { ReceptionistPolicyService, RuntimeReadiness } from "./receptionist-policy.service";

export interface ReceptionistRuntimeConfig {
  receptionistId: string;
  workspaceId: string;
  configurationVersion: number;
  status: string;
  runtimeReadiness: RuntimeReadiness;
  identity: {
    name: string;
    roleTitle: string;
    industry: string;
    language: string;
    description: string | null;
  };
  voice: {
    speakingStyle: string;
    speakingRate: string;
    responsePacing: string;
    provider: string | null;
    voiceId: string | null;
  };
  greetings: {
    primary: string;
    afterHours: string | null;
  };
  instructions: string;
  personality: string[];
  objectives: string[];
  behavior: {
    responseLength: string;
    askOneQuestionAtATime: boolean;
    confirmCriticalDetails: boolean;
    allowCallerInterruptions: boolean;
    silenceHandling: string;
    silenceTimeoutSeconds: number;
    unknownAnswerBehavior: string;
  };
  afterHours: {
    mode: string;
    useCustomGreeting: boolean;
  };
  escalation: {
    onHumanRequest: boolean;
    onEmergency: boolean;
    onRepeatedFailure: boolean;
    onUnsupportedRequest: boolean;
  };
  transfers: Array<{
    id: string;
    name: string;
    type: string;
    destination: string;
    priority: number;
    purpose: string;
  }>;
}

export class ReceptionistRuntimeConfigService {
  /**
   * Assembles a comprehensive, validated runtime configuration object.
   * This represents the stable contract Phase 3 realtime voice worker will consume.
   */
  static buildReceptionistRuntimeConfig(
    receptionist: Receptionist,
    transferDestinations: Array<
      ReceptionistTransferDestination & { transferDestination?: TransferDestination | null }
    > = []
  ): ReceptionistRuntimeConfig {
    const voiceConfig = (receptionist.voiceConfig as Record<string, any>) || {};
    const personalityConfig = (receptionist.personalityConfig as { traits?: string[] }) || {};
    const objectiveConfig = (receptionist.objectiveConfig as { objectives?: string[] }) || {};
    const behaviorConfig = (receptionist.behaviorConfig as Record<string, any>) || {};
    const afterHoursConfig = (receptionist.afterHoursConfig as Record<string, any>) || {};
    const escalationConfig = (receptionist.escalationConfig as Record<string, any>) || {};

    const activeTransfers = transferDestinations
      .filter(
        (td) => td.enabled && td.transferDestination && td.transferDestination.status === "ACTIVE"
      )
      .map((td) => ({
        id: td.transferDestination!.id,
        name: td.transferDestination!.name,
        type: td.transferDestination!.type,
        destination: td.transferDestination!.destination,
        priority: td.priority,
        purpose: td.purpose,
      }))
      .sort((a, b) => a.priority - b.priority);

    return {
      receptionistId: receptionist.id,
      workspaceId: receptionist.workspaceId,
      configurationVersion: receptionist.configurationVersion,
      status: receptionist.status,
      runtimeReadiness: ReceptionistPolicyService.getRuntimeReadiness(receptionist),
      identity: {
        name: receptionist.name,
        roleTitle: receptionist.roleTitle,
        industry: receptionist.industry,
        language: receptionist.primaryLanguage,
        description: receptionist.description,
      },
      voice: {
        speakingStyle: voiceConfig.speakingStyle || "professional",
        speakingRate: voiceConfig.speakingRate || "normal",
        responsePacing: voiceConfig.responsePacing || "balanced",
        provider: voiceConfig.provider || null,
        voiceId: voiceConfig.voiceId || null,
      },
      greetings: {
        primary: receptionist.greeting || "",
        afterHours: receptionist.afterHoursGreeting,
      },
      instructions: receptionist.instructions || "",
      personality: personalityConfig.traits || [],
      objectives: objectiveConfig.objectives || [],
      behavior: {
        responseLength: behaviorConfig.responseLength || "balanced",
        askOneQuestionAtATime: behaviorConfig.askOneQuestionAtATime ?? true,
        confirmCriticalDetails: behaviorConfig.confirmCriticalDetails ?? true,
        allowCallerInterruptions: behaviorConfig.allowCallerInterruptions ?? true,
        silenceHandling: behaviorConfig.silenceHandling || "PROMPT_ONCE",
        silenceTimeoutSeconds: behaviorConfig.silenceTimeoutSeconds || 8,
        unknownAnswerBehavior: behaviorConfig.unknownAnswerBehavior || "take_message",
      },
      afterHours: {
        mode: afterHoursConfig.mode || "TAKE_MESSAGE",
        useCustomGreeting: Boolean(afterHoursConfig.useCustomGreeting),
      },
      escalation: {
        onHumanRequest: escalationConfig.onHumanRequest ?? true,
        onEmergency: escalationConfig.onEmergency ?? true,
        onRepeatedFailure: escalationConfig.onRepeatedFailure ?? true,
        onUnsupportedRequest: escalationConfig.onUnsupportedRequest ?? false,
      },
      transfers: activeTransfers,
    };
  }
}
