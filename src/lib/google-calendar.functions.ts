import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_BASE = "https://connector-gateway.lovable.dev";
const GATEWAY_URL = `${GATEWAY_BASE}/google_calendar/calendar/v3`;

// Detect every linked Google Calendar connection from the project env.
// Connector secrets follow the pattern GOOGLE_CALENDAR_API_KEY, GOOGLE_CALENDAR_API_KEY_2, ...
function listAccountKeys(): string[] {
  const keys = Object.keys(process.env).filter((k) => /^GOOGLE_CALENDAR_API_KEY(_\d+)?$/.test(k) && process.env[k]);
  return keys.sort((a, b) => a.length - b.length || a.localeCompare(b));
}

function authHeadersFor(accountKey?: string | null) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  const keys = listAccountKeys();
  if (keys.length === 0) throw new Error("No Google Calendar account is connected");
  const useKey = accountKey && keys.includes(accountKey) ? accountKey : keys[0];
  const value = process.env[useKey];
  if (!value) throw new Error(`Google Calendar account ${useKey} is not configured`);
  return {
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": value,
      "Content-Type": "application/json",
    },
    accountKey: useKey,
  };
}

export const listGoogleCalendarAccounts = createServerFn({ method: "GET" }).handler(async () => {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) return { accounts: [] as Array<{ key: string; email: string | null; calendars: { id: string; summary: string; primary: boolean }[] }> };
  const keys = listAccountKeys();
  const accounts = await Promise.all(keys.map(async (key) => {
    try {
      const res = await fetch(`${GATEWAY_URL}/users/me/calendarList`, {
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": process.env[key]! },
      });
      if (!res.ok) return { key, email: null, calendars: [] };
      const json: any = await res.json().catch(() => ({}));
      const items: any[] = json.items ?? [];
      const primary = items.find((c) => c.primary) ?? items[0];
      return {
        key,
        email: primary?.id ?? null,
        calendars: items.map((c) => ({ id: c.id, summary: c.summary, primary: !!c.primary })),
      };
    } catch {
      return { key, email: null, calendars: [] };
    }
  }));
  return { accounts };
});

const EventInput = z.object({
  accountKey: z.string().optional().nullable(),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional().nullable(),
  startISO: z.string().min(1),
  durationMinutes: z.number().int().min(5).max(1440),
  attendees: z.array(z.string().email()).max(50).optional().default([]),
  reminderMinutes: z.number().int().min(0).max(40320).optional().default(15),
  createMeetLink: z.boolean().optional().default(true),
  customLocation: z.string().max(2000).optional().nullable(),
  calendarId: z.string().optional().default("primary"),
});

function buildBody(data: z.infer<typeof EventInput>) {
  const start = new Date(data.startISO);
  const end = new Date(start.getTime() + data.durationMinutes * 60_000);
  const body: any = {
    summary: data.title,
    description: data.description ?? undefined,
    location: data.customLocation ?? undefined,
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
    const { headers, accountKey } = authHeadersFor(data.accountKey);
    const url = `${GATEWAY_URL}/calendars/${encodeURIComponent(data.calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`;
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(buildBody(data)) });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Google Calendar create failed [${res.status}]: ${JSON.stringify(json)}`);
    const meetLink = json.hangoutLink || json.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === "video")?.uri || null;
    return { eventId: json.id as string, htmlLink: json.htmlLink as string, meetLink, calendarId: data.calendarId, accountKey };
  });

const UpdateInput = EventInput.extend({ eventId: z.string().min(1) });

export const updateGoogleCalendarEvent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => UpdateInput.parse(d))
  .handler(async ({ data }) => {
    const { headers, accountKey } = authHeadersFor(data.accountKey);
    const url = `${GATEWAY_URL}/calendars/${encodeURIComponent(data.calendarId)}/events/${encodeURIComponent(data.eventId)}?conferenceDataVersion=1&sendUpdates=all`;
    const res = await fetch(url, { method: "PATCH", headers, body: JSON.stringify(buildBody(data)) });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Google Calendar update failed [${res.status}]: ${JSON.stringify(json)}`);
    const meetLink = json.hangoutLink || json.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === "video")?.uri || null;
    return { eventId: json.id as string, htmlLink: json.htmlLink as string, meetLink, accountKey };
  });

export const deleteGoogleCalendarEvent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    eventId: z.string().min(1),
    calendarId: z.string().optional().default("primary"),
    accountKey: z.string().optional().nullable(),
  }).parse(d))
  .handler(async ({ data }) => {
    const { headers } = authHeadersFor(data.accountKey);
    const url = `${GATEWAY_URL}/calendars/${encodeURIComponent(data.calendarId)}/events/${encodeURIComponent(data.eventId)}?sendUpdates=all`;
    const res = await fetch(url, { method: "DELETE", headers });
    if (!res.ok && res.status !== 410 && res.status !== 404) {
      const t = await res.text().catch(() => "");
      throw new Error(`Google Calendar delete failed [${res.status}]: ${t}`);
    }
    return { ok: true };
  });
