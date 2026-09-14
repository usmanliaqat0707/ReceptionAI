# Provider Webhooks & Cryptographic Verification

## Supported Webhook Sources

ReceptionAI handles status callbacks from:
1. **Twilio SMS Webhooks** (`POST /api/v1/webhooks/communications/twilio`)
2. **Resend Email Webhooks** (`POST /api/v1/webhooks/communications/resend`)

---

## Signature Verification

### 1. Twilio Webhook Security
Twilio signs webhook payloads using HMAC-SHA1 computed over the full URL and sorted POST parameters with the workspace's Twilio Auth Token.
- Header: `X-Twilio-Signature`
- Timing safe comparison prevents timing attacks.
- Rejects unsigned requests with HTTP 401.

### 2. Resend Webhook Security
Resend uses standard Svix-compatible webhook signatures.
- Headers: `svix-id`, `svix-timestamp`, `svix-signature`
- Verifies timestamp tolerance to defeat replay attacks (default: 300 seconds).
- Recomputed HMAC-SHA256 signature must match the header.

---

## Monotonic Delivery Status Transitions

Carrier delivery reports often arrive out of order due to distributed queuing. For example, a carrier might report a `delivered` status before a delayed `sent` confirmation arrives.

To prevent status regressions, ReceptionAI enforces monotonic state progression:

```typescript
const STATUS_RANK: Record<string, number> = {
  PENDING: 1,
  QUEUED: 2,
  SENDING: 3,
  SENT: 4,
  DELIVERED: 5,
  FAILED: 5,
  SUPPRESSED: 5,
};
```

If an incoming webhook attempts to update a communication from `DELIVERED` back to `SENT`, the transition is dropped and logged as `{ ignoredOutOfOrder: true }`.

---

## Automatic Suppression Handling

### Twilio Error 21610 (STOP / Opt-Out)
When Twilio reports error `21610` (the recipient unsubscribed via STOP text), the recipient's phone number is automatically written into `CommunicationSuppression` with reason `USER_OPTOUT`. Future automated transactional messages to this number will be suppressed.

### Resend Hard Bounces
When Resend emits `email.bounced` with type `hard_bounce`, the email address is stored in `CommunicationSuppression` with reason `HARD_BOUNCE` to preserve domain reputation.
