import {
  prisma,
  CommunicationChannel,
  CommunicationPurpose,
  CommunicationSourceType,
} from "@receptionai/db";
import {
  MAX_COMMUNICATION_RETRY_ATTEMPTS,
  EXPONENTIAL_BACKOFF_BASE_MS,
  MAX_BACKOFF_MS,
} from "@receptionai/config";
import { CommunicationPolicyService } from "./communication-policy.service";
import { TemplateEngineService } from "./template-engine.service";
import { DEFAULT_COMMUNICATION_TEMPLATES } from "./default-templates";
import { CommunicationProviderFactory } from "../providers/provider-factory";

export interface EnqueueCommunicationParams {
  workspaceId: string;
  channel: CommunicationChannel;
  purpose: CommunicationPurpose;
  contactId?: string;
  recipientAddress?: string;
  sourceType?: CommunicationSourceType;
  sourceId?: string;
  appointmentId?: string;
  receptionistId?: string;
  testSessionId?: string;
  idempotencyKey?: string;
  variables?: Record<string, string | number | null | undefined>;
}

export class CommunicationDeliveryService {
  /**
   * Resolves or seeds the appropriate template for a given channel and purpose.
   */
  public static async getTemplateForPurpose(
    workspaceId: string,
    channel: CommunicationChannel,
    purpose: CommunicationPurpose
  ): Promise<{
    key: string;
    version: number;
    subjectTemplate?: string | null;
    bodyTemplate: string;
  }> {
    // 1. Look for workspace custom active template
    const customTemplate = await prisma.communicationTemplate.findFirst({
      where: {
        workspaceId,
        channel,
        purpose,
        status: "ACTIVE",
      },
      orderBy: { version: "desc" },
    });

    if (customTemplate) {
      return {
        key: customTemplate.key,
        version: customTemplate.version,
        subjectTemplate: customTemplate.subjectTemplate,
        bodyTemplate: customTemplate.bodyTemplate,
      };
    }

    // 2. Fall back to default template
    const defaultDef = DEFAULT_COMMUNICATION_TEMPLATES.find(
      (t) => t.channel === channel && t.purpose === purpose
    );

    if (defaultDef) {
      return {
        key: defaultDef.key,
        version: 1,
        subjectTemplate: defaultDef.subjectTemplate,
        bodyTemplate: defaultDef.bodyTemplate,
      };
    }

    // Generic fallback
    return {
      key: "generic_transactional",
      version: 1,
      subjectTemplate: channel === "EMAIL" ? "Notification from ReceptionAI" : undefined,
      bodyTemplate: "You have a new notification regarding your service.",
    };
  }

  /**
   * Enqueues a communication intent into the transactional outbox.
   * Deterministic idempotency prevents duplicate records.
   */
  public static async enqueue(params: EnqueueCommunicationParams) {
    const {
      workspaceId,
      channel,
      purpose,
      contactId,
      recipientAddress,
      sourceType,
      sourceId,
      appointmentId,
      receptionistId,
      testSessionId,
      idempotencyKey,
      variables = {},
    } = params;

    // 1. Idempotency check: if key already exists, return existing communication
    if (idempotencyKey) {
      const existing = await prisma.outboundCommunication.findUnique({
        where: {
          workspaceId_idempotencyKey: {
            workspaceId,
            idempotencyKey,
          },
        },
      });
      if (existing) {
        return existing;
      }
    }

    // 2. Evaluate Policy
    const policyResult = await CommunicationPolicyService.evaluatePolicy({
      workspaceId,
      channel,
      purpose,
      contactId,
      recipientAddress,
    });

    if (!policyResult.allowed) {
      // If disallowed due to suppression or settings, record as SUPPRESSED or abort
      if (policyResult.reason?.includes("suppressed")) {
        const suppressionComm = await prisma.outboundCommunication.create({
          data: {
            workspaceId,
            channel,
            purpose,
            recipientContactId: contactId,
            recipientAddress: policyResult.recipientAddress || recipientAddress || "unknown",
            body: `[SUPPRESSED]: ${policyResult.reason}`,
            status: "SUPPRESSED",
            sourceType,
            sourceId,
            appointmentId,
            receptionistId,
            testSessionId,
            idempotencyKey,
            metadata: { suppressionReason: policyResult.reason },
          },
        });
        return suppressionComm;
      }

      // If channel or purpose disabled by policy, return null
      return null;
    }

    // 3. Resolve Template
    const template = await this.getTemplateForPurpose(workspaceId, channel, purpose);

    // 4. Enrich variables from database entities if contact or appointment exists
    const enrichedVariables = { ...variables };

    if (contactId && !enrichedVariables.customer_first_name) {
      const contact = await prisma.contact.findUnique({ where: { id: contactId } });
      if (contact) {
        enrichedVariables.customer_first_name = contact.firstName;
        enrichedVariables.customer_last_name = contact.lastName || "";
        enrichedVariables.customer_phone = contact.phone || "";
        enrichedVariables.customer_email = contact.email || "";
      }
    }

    if (workspaceId && !enrichedVariables.business_name) {
      const profile = await prisma.businessProfile.findUnique({ where: { workspaceId } });
      if (profile) {
        enrichedVariables.business_name = profile.businessName;
        enrichedVariables.business_phone = profile.phone || "";
      } else {
        const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
        enrichedVariables.business_name = ws?.name || "Our Office";
      }
    }

    // 5. Render Template
    const renderedBody = TemplateEngineService.render(template.bodyTemplate, enrichedVariables);
    const renderedSubject = template.subjectTemplate
      ? TemplateEngineService.render(template.subjectTemplate, enrichedVariables)
      : null;

    const estimatedSegments =
      channel === "SMS" ? Math.max(1, Math.ceil(renderedBody.length / 160)) : 1;

    // 6. Insert into Outbox (PENDING)
    const communication = await prisma.outboundCommunication.create({
      data: {
        workspaceId,
        channel,
        purpose,
        recipientContactId: policyResult.recipientContactId,
        recipientAddress: policyResult.recipientAddress!,
        templateKey: template.key,
        templateVersion: template.version,
        subject: renderedSubject,
        body: renderedBody,
        status: "PENDING",
        sourceType,
        sourceId,
        appointmentId,
        receptionistId,
        testSessionId,
        idempotencyKey,
        estimatedSegments,
        metadata: { variables: enrichedVariables },
      },
    });

    // Record audit event
    await prisma.auditLog.create({
      data: {
        workspaceId,
        action: "communication.created",
        resourceType: "communication",
        resourceId: communication.id,
        metadata: {
          channel,
          purpose,
          status: "PENDING",
          sourceType,
        },
      },
    });

    return communication;
  }

  /**
   * Delivers a single communication via the active provider adapter.
   */
  public static async deliver(communicationId: string) {
    const comm = await prisma.outboundCommunication.findUnique({
      where: { id: communicationId },
      include: {
        deliveryAttempts: true,
      },
    });

    if (!comm || comm.status === "DELIVERED" || comm.status === "SUPPRESSED" || comm.status === "CANCELLED") {
      return comm;
    }

    // Check suppression right before sending
    const suppressionCheck = await CommunicationPolicyService.isSuppressed(
      comm.workspaceId,
      comm.channel,
      comm.recipientAddress
    );
    if (suppressionCheck.suppressed) {
      const updated = await prisma.outboundCommunication.update({
        where: { id: comm.id },
        data: {
          status: "SUPPRESSED",
          metadata: {
            ...((comm.metadata as any) || {}),
            suppressionReason: suppressionCheck.reason,
          },
        },
      });
      return updated;
    }

    const currentAttempt = comm.deliveryAttempts.length + 1;
    const attemptRecord = await prisma.communicationDeliveryAttempt.create({
      data: {
        workspaceId: comm.workspaceId,
        communicationId: comm.id,
        provider: comm.channel === "SMS" ? CommunicationProviderFactory.getSmsProvider().name : CommunicationProviderFactory.getEmailProvider().name,
        attempt: currentAttempt,
        status: "SENDING",
      },
    });

    await prisma.outboundCommunication.update({
      where: { id: comm.id },
      data: { status: "SENDING" },
    });

    let result: any;
    if (comm.channel === "SMS") {
      const provider = CommunicationProviderFactory.getSmsProvider();
      result = await provider.send({
        to: comm.recipientAddress,
        body: comm.body,
        idempotencyKey: comm.idempotencyKey || comm.id,
        workspaceId: comm.workspaceId,
        communicationId: comm.id,
      });
    } else {
      const provider = CommunicationProviderFactory.getEmailProvider();
      result = await provider.send({
        to: comm.recipientAddress,
        fromAddress: "notifications@receptionai.com",
        fromName: "ReceptionAI",
        subject: comm.subject || "Notification",
        text: comm.body,
        idempotencyKey: comm.idempotencyKey || comm.id,
        workspaceId: comm.workspaceId,
        communicationId: comm.id,
      });
    }

    const now = new Date();
    if (result.success) {
      // Sent successfully to provider
      await prisma.communicationDeliveryAttempt.update({
        where: { id: attemptRecord.id },
        data: {
          providerMessageId: result.providerMessageId,
          status: result.status,
          completedAt: now,
        },
      });

      const updated = await prisma.outboundCommunication.update({
        where: { id: comm.id },
        data: {
          status: result.status,
          sentAt: now,
          estimatedSegments: result.estimatedSegments || comm.estimatedSegments,
        },
      });

      await prisma.auditLog.create({
        data: {
          workspaceId: comm.workspaceId,
          action: "communication.sent",
          resourceType: "communication",
          resourceId: comm.id,
          metadata: {
            channel: comm.channel,
            providerMessageId: result.providerMessageId,
            attempt: currentAttempt,
          },
        },
      });

      return updated;
    } else {
      // Failed
      const isTransient = result.isTransient && currentAttempt < MAX_COMMUNICATION_RETRY_ATTEMPTS;

      await prisma.communicationDeliveryAttempt.update({
        where: { id: attemptRecord.id },
        data: {
          status: "FAILED",
          errorCode: result.errorCode,
          errorMessageSafe: result.errorMessage,
          completedAt: now,
        },
      });

      const nextStatus = isTransient ? "QUEUED" : "FAILED";
      const backoffMs = Math.min(MAX_BACKOFF_MS, EXPONENTIAL_BACKOFF_BASE_MS * Math.pow(2, currentAttempt - 1));
      const updated = await prisma.outboundCommunication.update({
        where: { id: comm.id },
        data: {
          status: nextStatus,
          failedAt: isTransient ? null : now,
          metadata: {
            ...((comm.metadata as any) || {}),
            lastError: result.errorMessage,
            errorCode: result.errorCode,
            retryDelayMs: isTransient ? backoffMs : undefined,
          },
        },
      });

      await prisma.auditLog.create({
        data: {
          workspaceId: comm.workspaceId,
          action: isTransient ? "communication.retry_queued" : "communication.failed",
          resourceType: "communication",
          resourceId: comm.id,
          metadata: {
            channel: comm.channel,
            attempt: currentAttempt,
            errorCode: result.errorCode,
            isTransient,
          },
        },
      });

      return updated;
    }
  }

  /**
   * Processes all pending communications in the outbox.
   */
  public static async processOutbox(workspaceId?: string) {
    const where: any = {
      status: { in: ["PENDING", "QUEUED"] },
    };
    if (workspaceId) {
      where.workspaceId = workspaceId;
    }

    const pending = await prisma.outboundCommunication.findMany({
      where,
      take: 50,
      orderBy: { createdAt: "asc" },
    });

    const results = [];
    for (const comm of pending) {
      try {
        const res = await this.deliver(comm.id);
        results.push(res);
      } catch (err: any) {
        console.error(`Outbox delivery error for ${comm.id}:`, err.message);
      }
    }
    return results;
  }

  /**
   * Operator-initiated manual retry for a failed communication.
   */
  public static async manualRetry(workspaceId: string, communicationId: string) {
    const comm = await prisma.outboundCommunication.findFirst({
      where: { id: communicationId, workspaceId },
    });

    if (!comm) {
      throw new Error("COMMUNICATION_NOT_FOUND");
    }

    if (comm.status === "DELIVERED") {
      throw new Error("COMMUNICATION_ALREADY_DELIVERED");
    }

    // Reset status to QUEUED and trigger delivery
    await prisma.outboundCommunication.update({
      where: { id: comm.id },
      data: { status: "QUEUED" },
    });

    await prisma.auditLog.create({
      data: {
        workspaceId,
        action: "communication.retry_requested",
        resourceType: "communication",
        resourceId: comm.id,
      },
    });

    return await this.deliver(comm.id);
  }
}
