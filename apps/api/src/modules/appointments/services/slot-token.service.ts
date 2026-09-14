import crypto from "crypto";

export interface SlotTokenPayload {
  workspaceId: string;
  serviceId: string;
  calendarIntegrationId: string;
  startAt: string; // ISO datetime
  endAt: string;   // ISO datetime
  expiresAt: number; // timestamp in ms
}

export class SlotTokenService {
  private secretKey: string;

  constructor() {
    this.secretKey =
      process.env.SESSION_SECRET || "super_secret_session_secret_at_least_32_characters";
  }

  /**
   * Generates a tamper-proof signed opaque slot token.
   */
  generateSlotToken(payload: Omit<SlotTokenPayload, "expiresAt">, ttlMinutes = 5): string {
    const fullPayload: SlotTokenPayload = {
      ...payload,
      expiresAt: Date.now() + ttlMinutes * 60 * 1000,
    };

    const encoded = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
    const signature = crypto
      .createHmac("sha256", this.secretKey)
      .update(encoded)
      .digest("base64url");

    return `slot_${encoded}.${signature}`;
  }

  /**
   * Verifies and decodes an opaque slot token.
   * Throws SLOT_INVALID or SLOT_EXPIRED if tampered or timed out.
   */
  verifySlotToken(slotToken: string): SlotTokenPayload {
    if (!slotToken || !slotToken.startsWith("slot_")) {
      throw new Error("SLOT_INVALID: Invalid slot token prefix.");
    }

    const trimmed = slotToken.substring(5);
    const parts = trimmed.split(".");
    if (parts.length !== 2) {
      throw new Error("SLOT_INVALID: Malformed slot token structure.");
    }

    const [encoded, signature] = parts;
    const expectedSignature = crypto
      .createHmac("sha256", this.secretKey)
      .update(encoded)
      .digest("base64url");

    if (signature !== expectedSignature) {
      throw new Error("SLOT_INVALID: Slot token signature verification failed (tampered).");
    }

    let payload: SlotTokenPayload;
    try {
      payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    } catch {
      throw new Error("SLOT_INVALID: Slot token payload could not be decoded.");
    }

    if (Date.now() > payload.expiresAt) {
      throw new Error("SLOT_EXPIRED: Slot token has expired. Please check availability again.");
    }

    return payload;
  }
}

export const slotTokenService = new SlotTokenService();
