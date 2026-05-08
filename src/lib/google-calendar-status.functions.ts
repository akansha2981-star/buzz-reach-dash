import { createServerFn } from "@tanstack/react-start";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

export const getGoogleCalendarStatus = createServerFn({ method: "GET" }).handler(async () => {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const GOOGLE_CALENDAR_API_KEY = process.env.GOOGLE_CALENDAR_API_KEY;
  if (!LOVABLE_API_KEY || !GOOGLE_CALENDAR_API_KEY) {
    return { connected: false as const, email: null, calendars: [] as { id: string; summary: string; primary: boolean }[] };
  }
  const res = await fetch(`${GATEWAY_URL}/users/me/calendarList`, {
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GOOGLE_CALENDAR_API_KEY,
    },
  });
  if (!res.ok) {
    return { connected: false as const, email: null, calendars: [] };
  }
  const json: any = await res.json().catch(() => ({}));
  const items: any[] = json.items ?? [];
  const primary = items.find((c) => c.primary) ?? items[0];
  return {
    connected: true as const,
    email: primary?.id ?? null,
    calendars: items.map((c) => ({ id: c.id, summary: c.summary, primary: !!c.primary })),
  };
});
