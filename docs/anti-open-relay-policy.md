# Anti-Open-Relay Security Policy

## The Threat Model: AI LLM as Open Relay

In voice and text conversational AI architectures, a severe vulnerability arises when language models have access to unrestricted communication tools, e.g.:

```json
// DANGEROUS: OPEN RELAY PATTERN
{
  "tool": "send_sms",
  "arguments": {
    "to": "+19999999999",
    "body": "Congratulations, you won a free gift card! Click here: http://phish.example"
  }
}
```

If an attacker manipulates the voice conversation via prompt injection or jailbreak techniques, an unrestricted tool allows the bot to be abused as an automated spam, phishing, or harassment gateway on the business's paid Twilio or Resend credentials.

---

## ReceptionAI Anti-Open-Relay Enforcement

In ReceptionAI, open relay behavior is categorically blocked through multiple defense-in-depth layers:

### 1. Schema-Level Ban on Raw Destination & Body Parameters
The AI Realtime tool schemas (`sendSmsToolSchema` and `sendEmailToolSchema`) reject any request that attempts to pass destination addresses or raw body text:

```typescript
export const sendSmsToolSchema = z
  .object({
    contactId: z.string().min(1, "contactId is required"),
    purpose: communicationPurposeEnum,
    relatedResourceId: z.string().optional(),
    to: z.string().optional(),
    phone: z.string().optional(),
    body: z.string().optional(),
    text: z.string().optional(),
    message: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.to || data.phone || data.body || data.text || data.message) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "SECURITY_POLICY_VIOLATION: Arbitrary recipient numbers or message bodies are strictly prohibited. You must supply contactId and purpose only.",
      });
    }
  });
```

If any unauthorized argument is detected by the Tool Gateway, the call is rejected with `SECURITY_POLICY_VIOLATION` and logged in the audit trail.

### 2. Contact Record Resolution
The AI can only reference an existing, trusted `contactId`. The server looks up the contact record in PostgreSQL within the tenant's workspace:
- For SMS: Uses `contact.phone`
- For Email: Uses `contact.email`

The model cannot invent or reroute destinations.

### 3. Server-Controlled Templates
The actual content transmitted across Twilio or Resend is loaded from server-controlled templates based on the verified `purpose` (e.g., `APPOINTMENT_CONFIRMATION`, `CALLBACK_CONFIRMATION`). The model cannot inject arbitrary URLs, phishing links, or unapproved text into the message payload.
