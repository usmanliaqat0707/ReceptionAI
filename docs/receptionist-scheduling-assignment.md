# Receptionist Scheduling Capability & Assignment

## 1. Capability Scoping

AI receptionists only gain access to scheduling tools when the workspace has granted them the `SCHEDULE_APPOINTMENTS` objective.

### Enabled Tools:
When `SCHEDULE_APPOINTMENTS` is enabled in `receptionist.objectiveConfig.objectives`:
1. `find_service`: Searches and filters active services in the workspace catalog.
2. `check_availability`: Calculates open discrete slots and signs non-forgeable opaque slot tokens.
3. `get_appointment`: Retrieves appointment status by ID or contact phone.
4. `book_appointment`: Authorizes and creates confirmed appointments through the two-phase saga.
5. `reschedule_appointment`: Safely modifies appointment times and enforces cancellation cutoffs.
6. `cancel_appointment`: Idempotently cancels appointments and frees provider calendar slots.

If a receptionist lacks `SCHEDULE_APPOINTMENTS`, any attempt by the model to call scheduling tools is intercepted by the Tool Gateway and blocked with `TOOL_NOT_ENABLED`.

---

## 2. Runtime Readiness Validation

The `ReceptionistPolicyService` evaluates real-time system readiness before initiating live voice calls:
* If `SCHEDULE_APPOINTMENTS` is enabled, the system verifies:
  1. At least one active `Service` exists with positive duration.
  2. At least one `CalendarIntegration` is in `CONNECTED` status (`INTERNAL_DEMO` or `GOOGLE_CALENDAR`).
  3. Valid `BusinessHour` operating hours are configured.
* If any component is missing, `DetailedRuntimeReadiness.appointments` evaluates to `DEGRADED` or `DISABLED` with human-readable remediation messages shown in the builder dashboard.

---

## 3. Realtime Prompt Injection (Layer 2)

When scheduling tools are active, `RealtimeInstructionService` injects explicit scheduling rules into the model's runtime prompt:
* **Service Authority**: Always query `find_service` before offering service options.
* **Never Invent Times**: Always call `check_availability` to retrieve approved slots. Never guess availability.
* **Propose Before Booking**: Explicitly ask the caller: *"Would you like me to book [Service] on [Date] at [Time]?"*
* **Confirmation Execution**: Only state the appointment is booked after receiving a successful tool response from the server.
