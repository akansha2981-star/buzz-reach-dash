import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Calendar, CheckCircle2, AlertCircle, ExternalLink, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listGoogleCalendarAccounts } from "@/lib/google-calendar.functions";

export function GoogleCalendarStatusCard() {
  const fetchAccounts = useServerFn(listGoogleCalendarAccounts);
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["google-calendar-accounts"],
    queryFn: () => fetchAccounts(),
    staleTime: 60_000,
  });

  const accounts = data?.accounts ?? [];
  const connected = accounts.length > 0;

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
              <CheckCircle2 className="h-3 w-3" /> {accounts.length} account{accounts.length === 1 ? "" : "s"} connected
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-[10px] text-amber-600">
              <AlertCircle className="h-3 w-3" /> Not connected
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Choose which Google account a meeting syncs to from the meeting dialog. Add more accounts to give your team options.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {connected ? (
          <ul className="space-y-2">
            {accounts.map((a) => (
              <li key={a.key} className="flex items-start justify-between gap-3 rounded-lg border bg-muted/30 p-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate font-medium">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" /> {a.email ?? "(unable to load email)"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {a.calendars.length} calendar{a.calendars.length === 1 ? "" : "s"} accessible · key: <code className="rounded bg-background px-1">{a.key}</code>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No Google account is connected yet. Ask the workspace admin to connect Google Calendar.
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
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
          To add another Google account, ask Lovable: "connect another Google Calendar account". To remove one, ask: "disconnect Google Calendar".
        </p>
      </CardContent>
    </Card>
  );
}
