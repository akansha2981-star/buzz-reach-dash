import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { CheckCircle2, Clock4, AlarmClock, TrendingUp, Sparkles, Flame, Sunrise, Sun, Sunset, Moon, CalendarClock, LayoutList, ArrowUpDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MeShell } from "@/components/me/MeShell";
import { TaskCard } from "@/components/me/TaskCard";
import { useMyTasks, useTodayTasks, useUpcomingTasks, deriveStatus, type MeTask } from "@/lib/me";
import { format, parseISO, differenceInCalendarDays } from "date-fns";

export const Route = createFileRoute("/me/")({
  component: TodayPage,
});

type Bucket = { key: string; label: string; icon: any; hint: string; tasks: MeTask[] };

function TodayPage() {
  const { data: all = [] } = useMyTasks();
  const { data: todayTasks = [] } = useTodayTasks();
  const { data: upcoming = [] } = useUpcomingTasks(7);
  const today = format(new Date(), "yyyy-MM-dd");

  const stats = useMemo(() => {
    const completedToday = all.filter((t) => t.completed_at && t.completed_at.slice(0, 10) === today).length;
    const dueToday = todayTasks.filter((t) => t.status !== "completed").length;
    const doneOfDue = todayTasks.filter((t) => deriveStatus(t) === "completed").length;
    const overdue = todayTasks.filter((t) => deriveStatus(t) === "overdue").length;
    const totalToday = todayTasks.length || 1;
    const score = Math.round((doneOfDue / totalToday) * 100);

    const completions = new Set(all.filter((t) => t.completed_at).map((t) => t.completed_at!.slice(0, 10)));
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = format(new Date(Date.now() - i * 86400000), "yyyy-MM-dd");
      if (completions.has(d)) streak++;
      else if (i > 0) break;
    }
    return { completedToday, dueToday, doneOfDue, overdue, score, streak };
  }, [all, todayTasks, today]);

  const [groupBy, setGroupBy] = useState<"time-of-day" | "status" | "priority" | "none">("time-of-day");
  const [sortBy, setSortBy] = useState<"due-time" | "priority">("due-time");

  const sortedToday = useMemo(() => {
    const pr = { urgent: 0, high: 1, medium: 2, low: 3 } as const;
    const arr = [...todayTasks];
    arr.sort((a, b) => {
      if (sortBy === "priority") {
        if (pr[a.priority] !== pr[b.priority]) return pr[a.priority] - pr[b.priority];
        return (a.due_time ?? "99:99").localeCompare(b.due_time ?? "99:99");
      }
      const at = a.due_time ?? "99:99";
      const bt = b.due_time ?? "99:99";
      if (at !== bt) return at.localeCompare(bt);
      return pr[a.priority] - pr[b.priority];
    });
    return arr;
  }, [todayTasks, sortBy]);

  // Timeline buckets
  const buckets = useMemo<Bucket[]>(() => {
    if (groupBy === "none") {
      return sortedToday.length
        ? [{ key: "all", label: "All tasks", icon: LayoutList, hint: "Sorted", tasks: sortedToday }]
        : [];
    }
    if (groupBy === "status") {
      const map: Record<string, MeTask[]> = { overdue: [], pending: [], in_progress: [], completed: [] };
      for (const t of sortedToday) {
        const s = deriveStatus(t);
        (map[s] ?? map.pending).push(t);
      }
      return [
        { key: "overdue", label: "Overdue", icon: AlarmClock, hint: "Past due", tasks: map.overdue },
        { key: "in_progress", label: "In progress", icon: Sparkles, hint: "Active", tasks: map.in_progress },
        { key: "pending", label: "Pending", icon: CalendarClock, hint: "To do", tasks: map.pending },
        { key: "completed", label: "Completed", icon: CheckCircle2, hint: "Done", tasks: map.completed },
      ].filter((s) => s.tasks.length > 0);
    }
    if (groupBy === "priority") {
      const map: Record<string, MeTask[]> = { urgent: [], high: [], medium: [], low: [] };
      for (const t of sortedToday) (map[t.priority] ?? map.medium).push(t);
      return [
        { key: "urgent", label: "Urgent", icon: AlarmClock, hint: "Top priority", tasks: map.urgent },
        { key: "high", label: "High", icon: Sparkles, hint: "Important", tasks: map.high },
        { key: "medium", label: "Medium", icon: CalendarClock, hint: "Normal", tasks: map.medium },
        { key: "low", label: "Low", icon: Moon, hint: "Whenever", tasks: map.low },
      ].filter((s) => s.tasks.length > 0);
    }
    const b: Record<string, MeTask[]> = { overdue: [], morning: [], afternoon: [], evening: [], night: [], anytime: [], done: [] };
    for (const t of sortedToday) {
      if (t.status === "completed") { b.done.push(t); continue; }
      if (t.due_date && t.due_date < today) { b.overdue.push(t); continue; }
      if (!t.due_time) { b.anytime.push(t); continue; }
      const h = parseInt(t.due_time.slice(0, 2), 10);
      if (h < 12) b.morning.push(t);
      else if (h < 17) b.afternoon.push(t);
      else if (h < 21) b.evening.push(t);
      else b.night.push(t);
    }
    return [
      { key: "overdue", label: "Overdue", icon: AlarmClock, hint: "Catch these up first", tasks: b.overdue },
      { key: "morning", label: "Morning", icon: Sunrise, hint: "Before 12:00", tasks: b.morning },
      { key: "afternoon", label: "Afternoon", icon: Sun, hint: "12:00 – 17:00", tasks: b.afternoon },
      { key: "evening", label: "Evening", icon: Sunset, hint: "17:00 – 21:00", tasks: b.evening },
      { key: "night", label: "Night", icon: Moon, hint: "After 21:00", tasks: b.night },
      { key: "anytime", label: "Anytime today", icon: CalendarClock, hint: "No specific time", tasks: b.anytime },
      { key: "done", label: "Completed today", icon: CheckCircle2, hint: "Great work", tasks: b.done },
    ].filter((s) => s.tasks.length > 0);
  }, [sortedToday, today, groupBy]);

  return (
    <MeShell title={`Hi 👋 — ${format(new Date(), "EEEE, MMM d")}`} subtitle="Your personal workspace. Stay focused, ship more.">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Sparkles} label="Today's tasks" value={stats.dueToday} hint={`${stats.doneOfDue} done`} tone="from-primary/15 to-primary/5" />
        <StatCard icon={CheckCircle2} label="Completed today" value={stats.completedToday} tone="from-emerald-500/15 to-emerald-500/5" />
        <StatCard icon={AlarmClock} label="Overdue" value={stats.overdue} tone="from-rose-500/15 to-rose-500/5" />
        <StatCard icon={Flame} label="Day streak" value={stats.streak} hint={stats.streak > 0 ? "Keep going!" : "Start today"} tone="from-amber-500/15 to-amber-500/5" />
      </div>

      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
        <CardContent className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-primary to-primary-glow p-2.5 text-primary-foreground shadow">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Productivity score</p>
              <p className="font-display text-3xl font-bold">{stats.score}%</p>
            </div>
          </div>
          <div className="flex w-full max-w-xs flex-col gap-1.5">
            <Progress value={stats.score} className="h-2" />
            <p className="text-xs text-muted-foreground">{stats.doneOfDue} of {todayTasks.length} today completed</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Timeline — spans 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" /> Today's timeline
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={groupBy} onValueChange={(v) => setGroupBy(v as any)}>
                  <SelectTrigger className="h-8 w-[150px] text-xs">
                    <LayoutList className="mr-1 h-3.5 w-3.5" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="time-of-day">Time of day</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                    <SelectItem value="priority">Priority</SelectItem>
                    <SelectItem value="none">No grouping</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                  <SelectTrigger className="h-8 w-[140px] text-xs">
                    <ArrowUpDown className="mr-1 h-3.5 w-3.5" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="due-time">Due time</SelectItem>
                    <SelectItem value="priority">Priority</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {todayTasks.length === 0 ? (
              <EmptyHint text="Nothing on your plate today. Add a task to plan your day." />
            ) : (
              <div className="relative space-y-6 pl-6 before:absolute before:left-2 before:top-1 before:h-full before:w-px before:bg-gradient-to-b before:from-primary/40 before:via-border before:to-transparent">
                <AnimatePresence>
                  {buckets.map((section) => (
                    <div key={section.key} className="relative">
                      <span className="absolute -left-[22px] top-1 flex h-5 w-5 items-center justify-center rounded-full border bg-background shadow-sm">
                        <section.icon className="h-3 w-3 text-primary" />
                      </span>
                      <div className="mb-2 flex items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold">{section.label}</p>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{section.hint} · {section.tasks.length}</p>
                      </div>
                      <div className="space-y-2">
                        {section.tasks.map((t) => <TaskCard key={t.id} task={t} />)}
                      </div>
                    </div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Clock4 className="h-4 w-4 text-primary" /> Upcoming · 7 days</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {upcoming.filter((t) => t.due_date !== today).length === 0 ? (
              <EmptyHint text="No upcoming deadlines. Enjoy the calm." />
            ) : (
              <AnimatePresence>
                {upcoming.filter((t) => t.due_date !== today).slice(0, 8).map((t) => (
                  <div key={t.id}>
                    <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      in {differenceInCalendarDays(parseISO(t.due_date!), new Date())}d · {format(parseISO(t.due_date!), "EEE MMM d")}
                    </p>
                    <TaskCard task={t} />
                  </div>
                ))}
              </AnimatePresence>
            )}
          </CardContent>
        </Card>
      </div>
    </MeShell>
  );
}

function StatCard({ icon: Icon, label, value, hint, tone }: { icon: any; label: string; value: number | string; hint?: string; tone: string }) {
  return (
    <Card className={`overflow-hidden bg-gradient-to-br ${tone} border`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="mt-1 font-display text-2xl font-bold">{value}</p>
        {hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">{text}</p>;
}
