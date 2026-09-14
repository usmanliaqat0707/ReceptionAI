# Authoritative Availability Engine

## 1. Core Principles

The AI model (LLM) must **never** compute available calendar slots or invent arbitrary appointment timestamps. The `AvailabilityService` is the single source of truth for scheduling windows.

Availability calculation is an intersection of six constraints:
```text
Availability = (Operating Hours ∩ Special Overrides) 
             - Busy Intervals (from Provider)
             - Buffer Times (Service Before + After)
             - Lead Time Restrictions (Minimum Notice)
             - Advance Window Limits (Maximum Days Ahead)
```

---

## 2. Calculation Pipeline

When `availabilityService.getAvailability({ workspaceId, serviceId, date })` is invoked:

1. **Service Metadata**: Fetches authoritative `durationMinutes`, `bufferBeforeMinutes`, and `bufferAfterMinutes`.
2. **Scheduling Policy**: Fetches workspace `AppointmentPolicy` (e.g., minimum 60 min lead time, maximum 60 days in advance).
3. **Target Date Window**: Converts the requested date string (YYYY-MM-DD) into UTC boundaries in the workspace's IANA timezone.
4. **Operating Hours**:
   * Inspects `SpecialHour` overrides for the target date (holidays, emergencies).
   * Falls back to weekly recurring `BusinessHour` for the corresponding day of week.
   * If closed or outside operating hours, returns zero slots immediately.
5. **Provider Free/Busy Query**: Calls the active `CalendarProvider.getAvailability()` to fetch all existing bookings, external calendar events, and blocked ranges for that day.
6. **Slot Discretization**:
   * Steps across operating hours in increments equal to `durationMinutes` (or 15/30-minute grid alignment).
   * Verifies `[candidateStart, candidateEnd + bufferAfter]` does not overlap any busy range.
   * Verifies `candidateStart >= now + minimumLeadTimeMinutes`.
   * Verifies `candidateStart <= now + maximumAdvanceDays`.
7. **Opaque Token Issuance**: For each qualifying window, generates a signed, non-forgeable `slotId`.

---

## 3. Formatting & Conversational Presentation

Rather than presenting raw ISO-8601 strings to the voice caller, the engine formats slots for voice dialogue:
* `formattedDate`: e.g. `"Tuesday, September 15th"`
* `formattedTime`: e.g. `"10:00 AM"`
* `formattedRange`: e.g. `"10:00 AM to 10:30 AM"`

The model receives these structured slots and presents up to 3 options to the caller in natural conversation.
