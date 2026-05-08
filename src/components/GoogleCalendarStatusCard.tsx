import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Calendar, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getGoogleCalendarStatus } from "@/lib/google-calendar-status.functions";

export function GoogleCalendarStatusCard() {
  const fetchStatus = useServerFn(getGoogleCalendarStatus);
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["google-calendar-status"],
    queryFn: () => fetchStatus(),
    staleTime: 60_000,
  });

  const connected = data?.connected;
  const email = data?.email;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" /> Google Calendar Sync
          </span>
          {isLoading ? (
            <Badge variant="outline" className="text-[10px]">Checking…</Badge>
          ) : connected ? (
            <Badge className="gap-1 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 text-[10px]">
              <CheckCircle2 className="h-3 w-3" /> Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-[10px] text-amber-600">
              <AlertCircle className="h-3 w-3" /> Not connected
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Meetings scheduled in this portal sync to this Google account's calendar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {connected ? (
          <>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Synced account</p>
              <p className="mt-0.5 truncate font-medium">{email ?? "—"}</p>
              {data?.calendars && data.calendars.length > 1 && (
                <p className="mt-1 text-[11px] text-muted-foreground">{data.calendars.length} calendars accessible</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <a href="https://calendar.google.com" target="_blank" rel="noreferrer">
                  Open Google Calendar <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isRefetching}>
                {isRefetching ? "Refreshing…" : "Refresh"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              To switch accounts, ask the workspace admin to disconnect Google Calendar and reconnect with a different Google account.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Google Calendar isn't connected yet. Ask an admin to enable the integration so meetings auto-sync.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
