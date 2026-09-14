import { CalendarProvider } from "./calendar.interface";
import { InternalDemoCalendarProvider } from "./providers/internal-demo-calendar.provider";
import { GoogleCalendarProvider } from "./providers/google-calendar.provider";
import { CalendarProviderType } from "@receptionai/db";

export class CalendarProviderFactory {
  private static providers: Map<CalendarProviderType, CalendarProvider> = new Map();

  static {
    this.providers.set(CalendarProviderType.INTERNAL_DEMO, new InternalDemoCalendarProvider());
    this.providers.set(CalendarProviderType.GOOGLE_CALENDAR, new GoogleCalendarProvider());
  }

  static getProvider(type: CalendarProviderType): CalendarProvider {
    const provider = this.providers.get(type);
    if (!provider) {
      throw new Error(`CALENDAR_PROVIDER_UNAVAILABLE: Unsupported calendar provider type: ${type}`);
    }
    return provider;
  }

  /**
   * Used in automated tests to inject mock providers.
   */
  static setProvider(type: CalendarProviderType, provider: CalendarProvider): void {
    this.providers.set(type, provider);
  }

  static resetProviders(): void {
    this.providers.set(CalendarProviderType.INTERNAL_DEMO, new InternalDemoCalendarProvider());
    this.providers.set(CalendarProviderType.GOOGLE_CALENDAR, new GoogleCalendarProvider());
  }
}
