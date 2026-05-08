import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

function authHeaders() {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const GOOGLE_CALENDAR_API_KEY = process.env.GOOGLE_CALENDAR_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  if (!GOOGLE_CALENDAR_API_KEY) throw new Error("GOOGLE_CALENDAR_API_KEY is not configured — connect Google Calendar");
  return {
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": GOOGLE_CALENDAR_API_KEY,
    "Content-Type": "application/json",
  };
}

const EventInput = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional().nullable(),
  startISO: z.string().min(1),
  durationMinutes: z.number().int().min(5).max(1440),
  attendees: z.array(z.string().email()).max(50).optional().default([]),
  reminderMinutes: z.number().int().min(0).max(40320).optional().default(15),
  createMeetLink: z.boolean().optional().default(true),
  calendarId: z.string().optional().default("primary"),
});

function buildBody(data: z.infer<typeof EventInput>) {
  const start = new Date(data.startISO);
  const end = new Date(start.getTime() + data.durationMinutes * 60_000);
  const body: any = {
    summary: data.title,
    description: data.description ?? undefined,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    attendees: (data.attendees ?? []).map((email) => ({ email })),
    reminders: {
      useDefault: false,
      overrides: [{ method: "email", minutes: data.reminderMinutes }, { method: "popup", minutes: data.reminderMinutes }],
    },
  };
  if (data.createMeetLink) {
    body.conferenceData = {
      createRequest: {
        requestId: `lovable-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }
  return body;
}

export const createGoogleCalendarEvent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => EventInput.parse(d))
  .handler(async ({ data }) => {
    const url = `${GATEWAY_URL}/calendars/${encodeURIComponent(data.calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`;
    const res = await fetch(url, { method: "POST", headers: authHeaders(), body: JSON.stringify(buildBody(data)) });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Google Calendar create failed [${res.status}]: ${JSON.stringify(json)}`);
    const meetLink = json.hangoutLink || json.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === "video")?.uri || null;
    return { eventId: json.id as string, htmlLink: json.htmlLink as string, meetLink, calendarId: data.calendarId };
  });

const UpdateInput = EventInput.extend({ eventId: z.string().min(1) });

export const updateGoogleCalendarEvent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => UpdateInput.parse(d))
  .handler(async ({ data }) => {
    const url = `${GATEWAY_URL}/calendars/${encodeURIComponent(data.calendarId)}/events/${encodeURIComponent(data.eventId)}?conferenceDataVersion=1&sendUpdates=all`;
    const res = await fetch(url, { method: "PATCH", headers: authHeaders(), body: JSON.stringify(buildBody(data)) });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Google Calendar update failed [${res.status}]: ${JSON.stringify(json)}`);
    const meetLink = json.hangoutLink || json.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === "video")?.uri || null;
    return { eventId: json.id as string, htmlLink: json.htmlLink as string, meetLink };
  });

export const deleteGoogleCalendarEvent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ eventId: z.string().min(1), calendarId: z.string().optional().default("primary") }).parse(d))
  .handler(async ({ data }) => {
    const url = `${GATEWAY_URL}/calendars/${encodeURIComponent(data.calendarId)}/events/${encodeURIComponent(data.eventId)}?sendUpdates=all`;
    const res = await fetch(url, { method: "DELETE", headers: authHeaders() });
    if (!res.ok && res.status !== 410 && res.status !== 404) {
      const t = await res.text().catch(() => "");
      throw new Error(`Google Calendar delete failed [${res.status}]: ${t}`);
    }
    return { ok: true };
  });
