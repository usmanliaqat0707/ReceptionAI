export interface CalendarTimeRange {
  start: Date;
  end: Date;
}

export interface AvailabilityRequest {
  workspaceId: string;
  calendarIntegrationId: string;
  externalCalendarId?: string | null;
  startDate: Date;
  endDate: Date;
  timezone: string;
}

export interface AvailabilityResult {
  busyRanges: CalendarTimeRange[];
}

export interface CreateAppointmentRequest {
  workspaceId: string;
  calendarIntegrationId: string;
  externalCalendarId?: string | null;
  title: string;
  startAt: Date;
  endAt: Date;
  timezone: string;
  notes?: string | null;
  contactName: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  serviceName: string;
  appointmentId: string;
}

export interface ExternalAppointment {
  externalEventId: string;
  externalCalendarId?: string;
  startAt: Date;
  endAt: Date;
  status: "CONFIRMED" | "CANCELLED";
  htmlLink?: string;
}

export interface UpdateAppointmentRequest {
  workspaceId: string;
  calendarIntegrationId: string;
  externalCalendarId?: string | null;
  externalEventId: string;
  startAt: Date;
  endAt: Date;
  timezone: string;
  title?: string;
  notes?: string | null;
}

export interface CancelAppointmentRequest {
  workspaceId: string;
  calendarIntegrationId: string;
  externalCalendarId?: string | null;
  externalEventId: string;
  reason?: string;
}

export interface ExternalCancellationResult {
  success: boolean;
  externalEventId: string;
}

export interface GetAppointmentRequest {
  workspaceId: string;
  calendarIntegrationId: string;
  externalCalendarId?: string | null;
  externalEventId: string;
}

export interface CalendarProvider {
  readonly providerType: "INTERNAL_DEMO" | "GOOGLE_CALENDAR";
  getAvailability(input: AvailabilityRequest): Promise<AvailabilityResult>;
  createAppointment(input: CreateAppointmentRequest): Promise<ExternalAppointment>;
  updateAppointment(input: UpdateAppointmentRequest): Promise<ExternalAppointment>;
  cancelAppointment(input: CancelAppointmentRequest): Promise<ExternalCancellationResult>;
  getAppointment(input: GetAppointmentRequest): Promise<ExternalAppointment | null>;
}
