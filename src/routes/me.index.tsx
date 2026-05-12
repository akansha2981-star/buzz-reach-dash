import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { CheckCircle2, Clock4, AlarmClock, TrendingUp, Sparkles, Flame } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MeShell } from "@/components/me/MeShell";
import { TaskCard } from "@/components/me/TaskCard";
import { useMyTasks, useTodayTasks, useUpcomingTasks, deriveStatus } from "@/lib/me";
import { format, parseISO, differenceInCalendarDays } from "date-fns";

export const Route = createFileRoute("/me/")({
  component: TodayPage,
});

function TodayPage() {
  const { data: all = [] } = useMyTasks();
  const { data: todayTasks = [] } = useTodayTasks();
  const { data: upcoming = [] } = useUpcomingTasks(7);

  const stats = useMemo(() => {
    const completedToday = all.filter((t) => t.completed_at && t.completed_at.slice(0, 10) === format(new Date(), "yyyy-MM-dd")).length;
    const dueToday = todayTasks.length;
    const doneOfDue = todayTasks.filter((t) => deriveStatus(t) === "completed").length;
    const overdue = all.filter((t) => deriveStatus(t) === "overdue").length;
    const pending = all.filter((t) => t.status !== "completed").length;
    const score = dueToday === 0 ? (completedToday > 0 ? 100 : 0) : Math.round((doneOfDue / dueToday) * 100);

    // streak — consecutive days with at least one completion
    const completions = new Set(all.filter((t) => t.completed_at).map((t) => t.completed_at!.slice(0, 10)));
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = format(new Date(Date.now() - i * 86400000), "yyyy-MM-dd");
      if (completions.has(d)) streak++;
      else if (i > 0) break;
    }
    return { completedToday, dueToday, doneOfDue, overdue, pending, score, streak };
  }, [all, todayTasks]);

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
            <p className="text-xs text-muted-foreground">{stats.doneOfDue} of {stats.dueToday} due today completed</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" /> Today</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {todayTasks.length === 0 ? (
              <EmptyHint text="Nothing on your plate today. Quick add a task to plan your day." />
            ) : (
              <AnimatePresence>{todayTasks.map((t) => <TaskCard key={t.id} task={t} />)}</AnimatePresence>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Clock4 className="h-4 w-4 text-primary" /> Upcoming · 7 days</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 ? (
              <EmptyHint text="No upcoming deadlines. Enjoy the calm." />
            ) : (
              <AnimatePresence>
                {upcoming.slice(0, 6).map((t) => (
                  <div key={t.id}>
                    <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      in {differenceInCalendarDays(parseISO(t.due_date!), new Date())}d
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
