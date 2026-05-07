import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { ScrollText, Search, User as UserIcon } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/settings/logs")({
  component: () => (
    <RequireAuth perm="can_logs">
      <AppShell title="Activity Logs"><LogsPage /></AppShell>
    </RequireAuth>
  ),
});

const RANGES = [
  { value: "today", label: "Today", days: 0 },
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "all", label: "All time", days: 9999 },
];

const ACTION_LABELS: Record<string, string> = {
  "meeting.created": "Created meeting",
  "meeting.updated": "Updated meeting",
  "meeting.deleted": "Deleted meeting",
  "meeting.status_changed": "Changed meeting status",
  "institute.created": "Added profile",
  "institute.updated": "Updated profile",
  "institute.stage_changed": "Changed stage",
  "user.created": "Created user",
  "user.updated": "Updated user",
  "user.deleted": "Deleted user",
};

function actionColor(action: string) {
  if (action.includes("created")) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
  if (action.includes("deleted")) return "bg-rose-500/15 text-rose-700 dark:text-rose-400";
  if (action.includes("updated") || action.includes("changed")) return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  return "bg-muted text-muted-foreground";
}

function LogsPage() {
  const [search, setSearch] = useState("");
  const [range, setRange] = useState("7d");
  const [actorFilter, setActorFilter] = useState("all");

  const { data: logs = [] } = useQuery({
    queryKey: ["audit_logs", range],
    queryFn: async () => {
      let q = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500);
      const r = RANGES.find((x) => x.value === range)!;
      if (r.value === "today") q = q.gte("created_at", startOfDay(new Date()).toISOString()).lte("created_at", endOfDay(new Date()).toISOString());
      else if (r.value !== "all") q = q.gte("created_at", subDays(new Date(), r.days).toISOString());
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const actors = useMemo(() => Array.from(new Set(logs.map((l: any) => l.actor_email).filter(Boolean))), [logs]);

  const filtered = useMemo(() => logs.filter((l: any) => {
    if (actorFilter !== "all" && l.actor_email !== actorFilter) return false;
    if (search && !`${l.action} ${l.entity_label ?? ""} ${l.actor_email ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [logs, search, actorFilter]);

  // group by day
  const grouped = useMemo(() => {
    const m = new Map<string, any[]>();
    filtered.forEach((l: any) => {
      const k = format(new Date(l.created_at), "yyyy-MM-dd");
      const arr = m.get(k) ?? [];
      arr.push(l);
      m.set(k, arr);
    });
    return Array.from(m.entries());
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold">Activity Logs</h2>
        <p className="text-sm text-muted-foreground">Audit trail of every action performed across the platform.</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search action, user, or entity…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={actorFilter} onValueChange={setActorFilter}>
            <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              {actors.map((a: any) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{RANGES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
          </Select>
        </CardContent>
      </Card>

      {grouped.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <ScrollText className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No activity in this range.</p>
        </CardContent></Card>
      ) : (
        grouped.map(([day, items]) => (
          <Card key={day}>
            <CardHeader>
              <CardTitle className="text-base">{format(new Date(day), "EEEE, MMM d, yyyy")}</CardTitle>
              <CardDescription>{items.length} {items.length === 1 ? "event" : "events"}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.map((l: any) => (
                <div key={l.id} className="flex flex-col gap-2 rounded-lg border p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <UserIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">{l.actor_email ?? "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">
                        <Badge variant="outline" className={actionColor(l.action)}>{ACTION_LABELS[l.action] ?? l.action}</Badge>
                        {l.entity_label && <span className="ml-2">· {l.entity_label}</span>}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{format(new Date(l.created_at), "p")}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
