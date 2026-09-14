# Opaque Slot Tokens

## 1. Why Opaque Tokens?

If the AI model were allowed to pass arbitrary `startAt` and `endAt` timestamps into `book_appointment`, multiple failure modes arise:
1. **Hallucinated Times**: The model might book a time outside business hours (e.g. 3:15 AM).
2. **Arbitrary Durations**: The model might assign 10 minutes to a 60-minute surgery.
3. **Cross-Tenant or Cross-Calendar Attacks**: A caller might prompt the model to book into another doctor's calendar.
4. **Timezone Drift**: LLMs frequently miscalculate UTC offsets, leading to off-by-one-hour errors.

To solve this, `check_availability` returns opaque, server-signed **Slot Tokens** (`slotId`), and `book_appointment` strictly requires a valid `slotId`.

---

## 2. Token Format & Cryptographic Signing

Each `slotId` has the structure:
```text
slot_${base64url(payload)}.${hmac_sha256_signature}
```

The payload contains:
```typescript
interface SlotTokenPayload {
  workspaceId: string;
  serviceId: string;
  calendarIntegrationId: string;
  startAt: string;       // ISO-8601 UTC
  endAt: string;         // ISO-8601 UTC
  exp: number;           // Unix epoch expiration timestamp (default: 15 minutes)
}
```

### Verification Pipeline:
1. Splits string into prefix, payload, and signature.
2. Recomputes HMAC-SHA256 signature using `SESSION_SECRET` (or `ENCRYPTION_SECRET`).
3. Compares signatures using constant-time `crypto.timingSafeEqual` to prevent timing attacks.
4. Parses JSON payload and asserts `exp > Date.now() / 1000`.
5. If signature differs: throws `SLOT_INVALID`.
6. If expired: throws `SLOT_EXPIRED`.

---

## 3. Short Expiration & Revalidation

Slot tokens have a default TTL of 15 minutes (`DEFAULT_SLOT_EXPIRY_MINUTES`).
Even if a token is cryptographically valid and unexpired, the booking saga performs a **mandatory recheck** of external calendar availability at the moment of booking to prevent double-booking against external appointments made in the intervening seconds.
