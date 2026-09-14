# Transactional Outbox Pattern & Delivery Reliability

## Purpose

To ensure high availability and data integrity, ReceptionAI decouples synchronous business domain transactions (such as booking appointments or capturing leads) from external network calls to third-party providers (Twilio, Resend).

If an external telephony or email API experiences an outage, timeout, or rate-limit:
1. **The customer's appointment remains 100% booked and valid.**
2. The notification intent is safely stored in the `OutboundCommunication` table in PostgreSQL.
3. The delivery subsystem handles retries with exponential backoff or operator-initiated manual retries.

---

## State Machine Lifecycle

Outbound communication items transition through the following states:

```
             ┌───────────────┐
             │    PENDING    │
             └───────┬───────┘
                     │ (Policy Check & Template Render)
                     ▼
             ┌───────────────┐
             │    QUEUED     │
             └───────┬───────┘
                     │ (Dispatch Attempt)
                     ▼
             ┌───────────────┐
             │    SENDING    │
             └───────┬───────┘
                     ├──────────────────────────────┐
                     │ (Provider Accepted)          │ (Fatal / Exhausted Retries)
                     ▼                              ▼
             ┌───────────────┐              ┌───────────────┐
             │     SENT      │              │    FAILED     │
             └───────┬───────┘              └───────┬───────┘
                     │ (Carrier Webhook Callback)   │ (Manual Retry)
                     ▼                              │
             ┌───────────────┐                      │
             │   DELIVERED   │                      │
             └───────────────┘                      │
                     ▲                              │
                     └──────────────────────────────┘
```

- **SUPPRESSED**: Set immediately during policy evaluation if the recipient address has opted out (`STOP`), hard-bounced previously, or is blacklisted by an administrator.

---

## Delivery Attempt Logging & Retries

Every dispatch attempt is recorded in `CommunicationDeliveryAttempt`:
- `attempt`: 1-indexed attempt counter
- `provider`: active provider adapter name (`TWILIO`, `RESEND`, `MOCK_SMS`, `MOCK_EMAIL`)
- `providerMessageId`: provider-assigned SID or ID
- `errorCode`: normalized error code (e.g. `NETWORK_TIMEOUT`, `INVALID_CREDENTIALS`)
- `errorMessageSafe`: sanitized safe description

### Exponential Backoff Policy
- Base backoff: `1,000 ms`
- Factor: `2 ^ (attempt - 1)`
- Max backoff: `300,000 ms` (5 minutes)
- Max automatic attempts: `3`
