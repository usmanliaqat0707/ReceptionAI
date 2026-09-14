import {
  prisma,
  CommunicationChannel,
  CommunicationPurpose,
} from "@receptionai/db";

export interface PolicyEvaluationResult {
  allowed: boolean;
  reason?: string;
  delayUntil?: Date;
  recipientAddress?: string;
  recipientContactId?: string;
}

export class CommunicationPolicyService {
  /**
   * Resolves recipient address from trusted contact record.
   */
  public static async resolveRecipient(
    workspaceId: string,
    contactId: string,
    channel: CommunicationChannel
  ): Promise<{ contactId: string; address: string } | null> {
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        workspaceId,
        archivedAt: null,
      },
    });

    if (!contact) return null;

    if (channel === "SMS") {
      const phone = contact.normalizedPhone || contact.phone;
      if (!phone) return null;
      return { contactId: contact.id, address: phone };
    } else {
      const email = contact.normalizedEmail || contact.email;
      if (!email) return null;
      return { contactId: contact.id, address: email.toLowerCase().trim() };
    }
  }

  /**
   * Checks whether the recipient address is suppressed.
   */
  public static async isSuppressed(
    workspaceId: string,
    channel: CommunicationChannel,
    address: string
  ): Promise<{ suppressed: boolean; reason?: string }> {
    const normalized =
      channel === "EMAIL" ? address.toLowerCase().trim() : address.trim();

    const suppression = await prisma.communicationSuppression.findUnique({
      where: {
        workspaceId_channel_address: {
          workspaceId,
          channel,
          address: normalized,
        },
      },
    });

    if (suppression) {
      return {
        suppressed: true,
        reason: `Recipient is suppressed: ${suppression.reason}`,
      };
    }

    return { suppressed: false };
  }

  /**
   * Checks whether quiet hours apply to non-urgent communications.
   */
  public static isQuietHours(
    settings: {
      quietHoursEnabled: boolean;
      quietHoursStart: string | null;
      quietHoursEnd: string | null;
      timezone: string;
    },
    purpose: CommunicationPurpose
  ): boolean {
    // Transactional immediate appointment confirmations bypass quiet hours
    if (
      purpose === "APPOINTMENT_CONFIRMATION" ||
      purpose === "APPOINTMENT_RESCHEDULE" ||
      purpose === "APPOINTMENT_CANCELLATION"
    ) {
      return false;
    }

    if (!settings.quietHoursEnabled || !settings.quietHoursStart || !settings.quietHoursEnd) {
      return false;
    }

    try {
      const now = new Date();
      // Format current time in workspace timezone
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: settings.timezone || "America/New_York",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      const parts = formatter.formatToParts(now);
      const hour = parts.find((p) => p.type === "hour")?.value || "00";
      const minute = parts.find((p) => p.type === "minute")?.value || "00";
      const currentHM = `${hour}:${minute}`;

      const start = settings.quietHoursStart;
      const end = settings.quietHoursEnd;

      if (start <= end) {
        return currentHM >= start && currentHM < end;
      } else {
        // Quiet hours cross midnight (e.g. 21:00 to 08:00)
        return currentHM >= start || currentHM < end;
      }
    } catch {
      return false;
    }
  }

  /**
   * Evaluates overall communication policy before sending.
   */
  public static async evaluatePolicy(params: {
    workspaceId: string;
    channel: CommunicationChannel;
    purpose: CommunicationPurpose;
    contactId?: string;
    recipientAddress?: string;
  }): Promise<PolicyEvaluationResult> {
    const { workspaceId, channel, purpose, contactId, recipientAddress } = params;

    // 1. Get or create WorkspaceCommunicationSettings
    let settings = await prisma.workspaceCommunicationSettings.findUnique({
      where: { workspaceId },
    });

    if (!settings) {
      settings = await prisma.workspaceCommunicationSettings.create({
        data: { workspaceId },
      });
    }

    // 2. Check channel enabled
    if (channel === "SMS" && !settings.smsEnabled) {
      return { allowed: false, reason: "SMS channel is disabled for this workspace." };
    }
    if (channel === "EMAIL" && !settings.emailEnabled) {
      return { allowed: false, reason: "Email channel is disabled for this workspace." };
    }

    // 3. Check purpose toggles
    if (purpose === "APPOINTMENT_CONFIRMATION") {
      if (channel === "SMS" && !settings.sendSmsOnBooking) {
        return { allowed: false, reason: "SMS on booking is disabled in settings." };
      }
      if (channel === "EMAIL" && !settings.sendEmailOnBooking) {
        return { allowed: false, reason: "Email on booking is disabled in settings." };
      }
    } else if (purpose === "APPOINTMENT_RESCHEDULE") {
      if (channel === "SMS" && !settings.sendSmsOnReschedule) {
        return { allowed: false, reason: "SMS on reschedule is disabled in settings." };
      }
      if (channel === "EMAIL" && !settings.sendEmailOnReschedule) {
        return { allowed: false, reason: "Email on reschedule is disabled in settings." };
      }
    } else if (purpose === "APPOINTMENT_CANCELLATION") {
      if (channel === "SMS" && !settings.sendSmsOnCancellation) {
        return { allowed: false, reason: "SMS on cancellation is disabled in settings." };
      }
      if (channel === "EMAIL" && !settings.sendEmailOnCancellation) {
        return { allowed: false, reason: "Email on cancellation is disabled in settings." };
      }
    } else if (purpose === "CALLBACK_CONFIRMATION") {
      if (channel === "SMS" && !settings.sendSmsOnCallbackRequest) {
        return { allowed: false, reason: "SMS on callback request is disabled in settings." };
      }
      if (channel === "EMAIL" && !settings.sendEmailOnCallbackRequest) {
        return { allowed: false, reason: "Email on callback request is disabled in settings." };
      }
    }

    // 4. Resolve recipient address
    let resolvedAddress = recipientAddress;
    let resolvedContactId = contactId;

    if (contactId) {
      const resolved = await this.resolveRecipient(workspaceId, contactId, channel);
      if (!resolved) {
        return {
          allowed: false,
          reason: `No valid ${channel} address found for contact ${contactId}.`,
        };
      }
      resolvedAddress = resolved.address;
      resolvedContactId = resolved.contactId;

      // Check contact communication preference
      const pref = await prisma.contactCommunicationPreference.findUnique({
        where: { contactId },
      });
      if (pref) {
        if (channel === "SMS" && !pref.smsTransactionalAllowed) {
          return { allowed: false, reason: "Contact has opted out of SMS transactional communications." };
        }
        if (channel === "EMAIL" && !pref.emailTransactionalAllowed) {
          return { allowed: false, reason: "Contact has opted out of Email transactional communications." };
        }
      }
    }

    if (!resolvedAddress) {
      return { allowed: false, reason: "No recipient address provided or resolved." };
    }

    // 5. Check suppression
    const suppressionCheck = await this.isSuppressed(workspaceId, channel, resolvedAddress);
    if (suppressionCheck.suppressed) {
      return { allowed: false, reason: suppressionCheck.reason };
    }

    // 6. Check quiet hours
    const quiet = this.isQuietHours(settings, purpose);
    if (quiet) {
      return {
        allowed: false,
        reason: "Quiet hours currently in effect for non-urgent messages.",
      };
    }

    return {
      allowed: true,
      recipientAddress: resolvedAddress,
      recipientContactId: resolvedContactId,
    };
  }
}
