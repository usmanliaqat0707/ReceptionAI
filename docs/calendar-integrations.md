# Calendar Integrations Architecture

## 1. Overview & Provider Contract

ReceptionAI decouples the high-level appointment domain from external calendar systems through a unified provider contract: `CalendarProvider`.

```typescript
export interface CalendarProvider {
  getAvailability(params: GetAvailabilityParams): Promise<ProviderBusyRange[]>;
  createAppointment(params: CreateAppointmentParams): Promise<ProviderAppointmentResult>;
  updateAppointment(params: UpdateAppointmentParams): Promise<ProviderAppointmentResult>;
  cancelAppointment(params: CancelAppointmentParams): Promise<void>;
  getAppointment(params: GetAppointmentParams): Promise<ProviderAppointmentDetails | null>;
}
```

Neither the appointment booking engine nor the AI receptionist interacts directly with provider-specific APIs (Google Calendar, Outlook, etc.). All operations flow through the abstract provider interface.

---

## 2. Implemented Providers

### A. `INTERNAL_DEMO`
* **Zero-dependency, zero-cloud setup**: Runs directly on the workspace's PostgreSQL database.
* **Full Domain Fidelity**: Does not return hardcoded fake slots. It reads workspace business hours, special hours, service durations, buffer intervals, lead times, and existing bookings in PostgreSQL to compute mathematically exact availability.
* **Ideal for**: Rapid local development, sandbox evaluations, automated testing, and zero-configuration tenant onboarding.

### B. `GOOGLE_CALENDAR`
* **Production Two-Way Sync**: Integrates with Google Calendar API v3 (`events`, `freeBusy`).
* **OAuth 2.0 with Refresh Rotation**: Secure authorization code exchange, AES-256-GCM encrypted refresh token storage, and automatic token refresh when tokens expire.
* **Timezone Awareness**: Normalizes Google RFC3339 timestamps with the workspace's configured IANA timezone (e.g., `America/New_York`).
* **Conflict Recheck**: Queries `freeBusy` immediately before creating any calendar event to prevent races against external calendar modifications.

---

## 3. Credential Encryption & Key Management

OAuth refresh tokens, client secrets, and access tokens are sensitive credentials. ReceptionAI protects these at rest:
1. **Algorithm**: AES-256-GCM authenticated encryption.
2. **Payload Format**: `iv:authTag:ciphertext` in hexadecimal encoding.
3. **Key Derivation**: Configured via `ENCRYPTION_SECRET` (or `SESSION_SECRET` fallback).
4. **Decryption Scope**: Decryption happens strictly in-memory within `apps/api` during external calendar provider invocation. Decrypted tokens are never exposed in API responses or logs.

---

## 4. Reconciliation & Self-Healing

Network partitions or external calendar edits (e.g., user deletes an event directly inside Google Calendar) can lead to drift.

The `CalendarReconciliationService` runs periodically and on-demand:
1. **Inspects**: Reads all active `Appointment` records and pending `AppointmentOperation` sagas.
2. **Verifies**: Queries the external provider (`getAppointment`) to verify event existence.
3. **Compensates**: If an appointment was deleted externally, marks the local appointment `CANCELLED` and logs an immutable `AppointmentChange` audit record.
4. **Completes Stalled Sagas**: Retries or cancels uncommitted sagas older than 15 minutes.
