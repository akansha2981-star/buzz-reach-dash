import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  format,
  isSameDay,
  parseISO,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Inbox, Plus, Repeat } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MeShell } from "@/components/me/MeShell";
import { TaskCard } from "@/components/me/TaskCard";
import { TaskDialog } from "@/components/me/TaskDialog";
import { useMyTasks, type MeTask } from "@/lib/me";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/me/schedule")({
  component: SchedulePage,
});

function labelFor(date: Date) {
  const diff = differenceInCalendarDays(date, startOfDay(new Date()));
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return format(date, "EEEE");
  return format(date, "EEE, MMM d");
}

function SchedulePage() {
  const { data: tasks = [] } = useMyTasks();
  const [rangeStart, setRangeStart] = useState<Date>(startOfDay(new Date()));
  const [days, setDays] = useState(7);
  const [addDate, setAddDate] = useState<string | null>(null);

  const dates = useMemo(
    () => Array.from({ length: days }, (_, i) => addDays(rangeStart, i)),
    [rangeStart, days]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, MeTask[]>();
    const undated: MeTask[] = [];
    // Track (templateGroupId,date) that already have a concrete task, to avoid
    // duplicating with a projected virtual occurrence.
    const existing = new Set<string>();
    tasks.forEach((t) => {
      if (!t.due_date) {
        if (t.status !== "completed") undated.push(t);
        return;
      }
      const arr = map.get(t.due_date) ?? [];
      arr.push(t);
      map.set(t.due_date, arr);
      const gid = t.recurrence_parent_id ?? t.id;
      existing.add(`${gid}:${t.due_date}`);
    });

    // Project future recurring occurrences into every visible day so daily
    // recurring tasks are visible on the Schedule for every day, not only today.
    const rangeEnd = addDays(rangeStart, days - 1);
    const groups = new Map<string, MeTask>();
    tasks.forEach((t) => {
      if (!t.recurrence_rule || !t.due_date) return;
      const gid = t.recurrence_parent_id ?? t.id;
      // Keep the earliest instance as anchor (or the template itself).
      const cur = groups.get(gid);
      if (!cur || (t.due_date ?? "") < (cur.due_date ?? "")) groups.set(gid, t);
    });

    groups.forEach((tpl, gid) => {
      const rule = tpl.recurrence_rule!;
      const interval = Math.max(1, rule.interval || 1);
      let cur = parseISO(tpl.due_date!);
      let safety = 800;
      while (cur <= rangeEnd && safety-- > 0) {
        const key = format(cur, "yyyy-MM-dd");
        if (cur >= rangeStart && !existing.has(`${gid}:${key}`)) {
          const virt: MeTask = {
            ...tpl,
            id: `virtual:${gid}:${key}`,
            due_date: key,
            status: "pending",
            __virtual: true,
          } as any;
          const arr = map.get(key) ?? [];
          arr.push(virt);
          map.set(key, arr);
          existing.add(`${gid}:${key}`);
        }
        if (rule.freq === "daily" || rule.freq === "custom") cur = addDays(cur, interval);
        else if (rule.freq === "weekly") cur = addWeeks(cur, interval);
        else if (rule.freq === "monthly") cur = addMonths(cur, interval);
        else cur = addDays(cur, interval);
      }
    });

    // sort each day by time then priority
    const pr = { urgent: 0, high: 1, medium: 2, low: 3 } as const;
    map.forEach((arr) =>
      arr.sort((a, b) => {
        const at = a.due_time ?? "99:99";
        const bt = b.due_time ?? "99:99";
        if (at !== bt) return at.localeCompare(bt);
        return pr[a.priority] - pr[b.priority];
      })
    );
    return { map, undated };
  }, [tasks, rangeStart, days]);

  const totalInRange = dates.reduce(
    (n, d) => n + (grouped.map.get(format(d, "yyyy-MM-dd"))?.length ?? 0),
    0
  );

  const jump = (target: Date, len = 7) => {
    setRangeStart(startOfDay(target));
    setDays(len);
  };

  return (
    <MeShell
      title="Schedule"
      subtitle={`${format(rangeStart, "MMM d")} – ${format(addDays(rangeStart, days - 1), "MMM d, yyyy")} · ${totalInRange} task${totalInRange === 1 ? "" : "s"}`}
    >
      {/* Controls */}
      <Card className="border-border/60">
        <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={() => jump(new Date(), 7)}>
              Today
            </Button>
            <Button size="sm" variant="outline" onClick={() => jump(addDays(new Date(), 1), 1)}>
              Tomorrow
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => jump(startOfWeek(new Date(), { weekStartsOn: 1 }), 7)}
            >
              This week
            </Button>
            <Button size="sm" variant="outline" onClick={() => jump(new Date(), 14)}>
              Next 14 days
            </Button>
            <Button size="sm" variant="outline" onClick={() => jump(new Date(), 30)}>
              Next 30 days
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={() => setRangeStart(addDays(rangeStart, -days))}
              aria-label="Previous range"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={() => setRangeStart(addDays(rangeStart, days))}
              aria-label="Next range"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Agenda */}
      <div className="space-y-3">
        {dates.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const list = grouped.map.get(key) ?? [];
          const isToday = isSameDay(d, new Date());
          return (
            <section
              key={key}
              className={cn(
                "rounded-2xl border border-border/60 bg-card/50 p-3 sm:p-4",
                isToday && "ring-1 ring-primary/40 bg-primary/5"
              )}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl border text-center",
                      isToday
                        ? "border-primary/40 bg-gradient-to-br from-primary to-primary-glow text-primary-foreground"
                        : "border-border bg-background"
                    )}
                  >
                    <span className="text-[9px] uppercase leading-none tracking-wide opacity-80">
                      {format(d, "MMM")}
                    </span>
                    <span className="text-base font-bold leading-none">{format(d, "d")}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm font-semibold sm:text-base">
                      {labelFor(d)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {format(d, "EEEE")} · {list.length} task{list.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {list.length > 0 && (
                    <Badge variant="secondary" className="rounded-full">
                      {list.filter((t) => t.status !== "completed").length} open
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1 px-2"
                    onClick={() => setAddDate(key)}
                  >
                    <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add</span>
                  </Button>
                </div>
              </div>

              {list.length === 0 ? (
                <button
                  onClick={() => setAddDate(key)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 py-6 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  <CalendarDays className="h-4 w-4" /> Nothing planned — add a task
                </button>
              ) : (
                <div className="space-y-2">
                  {list.map((t) =>
                    (t as any).__virtual ? (
                      <div
                        key={t.id}
                        className="flex items-center gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-3 py-2 text-sm"
                      >
                        <Repeat className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="min-w-0 flex-1 truncate">{t.title}</span>
                        {t.due_time && (
                          <span className="text-[11px] text-muted-foreground">{t.due_time}</span>
                        )}
                        <Badge variant="outline" className="h-5 shrink-0 border-primary/30 px-1.5 text-[10px] uppercase text-primary">
                          Recurring
                        </Badge>
                      </div>
                    ) : (
                      <TaskCard key={t.id} task={t} />
                    )
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Unscheduled */}
      {grouped.undated.length > 0 && (
        <section className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-3 sm:p-4">
          <div className="mb-3 flex items-center gap-2">
            <Inbox className="h-4 w-4 text-muted-foreground" />
            <p className="font-display text-sm font-semibold">
              Unscheduled
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {grouped.undated.length} task{grouped.undated.length === 1 ? "" : "s"} without a due date
              </span>
            </p>
          </div>
          <div className="space-y-2">
            {grouped.undated.map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          </div>
        </section>
      )}

      <TaskDialog
        open={!!addDate}
        onOpenChange={(v) => !v && setAddDate(null)}
        defaultDate={addDate ?? undefined}
      />
    </MeShell>
  );
}
