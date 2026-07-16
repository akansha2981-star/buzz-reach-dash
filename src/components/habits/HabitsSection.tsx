import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Target, TrendingUp, Flame, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useHabitsAdv, useHabitLogsAdv, isDueOn, currentStreak, todayKey, completionRate } from "@/lib/habits";
import { HabitCard } from "./HabitCard";
import { HabitDialog } from "./HabitDialog";
import { cn } from "@/lib/utils";
import { useHabitReminders } from "@/hooks/useHabitReminders";

export function HabitsSection() {
  const { data: habits = [], isLoading } = useHabitsAdv();
  const { data: logs = [] } = useHabitLogsAdv(undefined, 60);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "today" | "pending">("today");

  useHabitReminders(habits);

  const todayHabits = useMemo(() => habits.filter((h) => isDueOn(h, new Date())), [habits]);
  const doneKeys = useMemo(
    () => new Set(logs.filter((l) => l.log_date === todayKey() && l.done).map((l) => l.habit_id)),
    [logs]
  );

  const filtered = useMemo(() => {
    if (filter === "all") return habits;
    if (filter === "today") return todayHabits;
    return todayHabits.filter((h) => !doneKeys.has(h.id));
  }, [habits, todayHabits, doneKeys, filter]);

  const stats = useMemo(() => {
    const doneToday = todayHabits.filter((h) => doneKeys.has(h.id)).length;
    const pending = todayHabits.length - doneToday;
    const totalStreak = habits.reduce((sum, h) => sum + currentStreak(h, logs), 0);
    const avgRate = habits.length
      ? Math.round(habits.reduce((s, h) => s + completionRate(h, logs, 30), 0) / habits.length)
      : 0;
    return { doneToday, pending, dueToday: todayHabits.length, totalStreak, avgRate };
  }, [habits, todayHabits, doneKeys, logs]);

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-emerald-500/10 via-card to-primary/10 p-5 shadow-sm">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-2 text-white shadow">
                <Target className="h-5 w-5" />
              </div>
              <h2 className="font-display text-2xl font-bold tracking-tight">Habit Tracker</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Build streaks. Track anything. One tap to check in.
            </p>
          </div>
          <Button
            onClick={() => setDialogOpen(true)}
            className="gap-1.5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md hover:shadow-lg"
          >
            <Plus className="h-4 w-4" /> New habit
          </Button>
        </div>
      </div>

      {/* Stats strip */}
      {habits.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard icon={CheckCircle2} label="Done today" value={`${stats.doneToday}/${stats.dueToday}`} tone="from-emerald-500/15 to-emerald-500/5" />
          <StatCard icon={AlertCircle} label="Pending" value={stats.pending} tone="from-amber-500/15 to-amber-500/5" />
          <StatCard icon={Flame} label="Combined streak" value={stats.totalStreak} tone="from-orange-500/15 to-orange-500/5" />
          <StatCard icon={TrendingUp} label="Avg 30d rate" value={`${stats.avgRate}%`} tone="from-primary/15 to-primary/5" />
        </div>
      )}

      {/* Filters */}
      {habits.length > 0 && (
        <div className="flex gap-1.5">
          {([
            { k: "today", l: `Today (${stats.dueToday})` },
            { k: "pending", l: `Pending (${stats.pending})` },
            { k: "all", l: `All (${habits.length})` },
          ] as const).map((f) => (
            <button
              key={f.k}
              onClick={() => setFilter(f.k)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                filter === f.k
                  ? "bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              )}
            >{f.l}</button>
          ))}
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map((i) => <div key={i} className="h-48 animate-pulse rounded-xl bg-muted/40" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <div className="rounded-full bg-primary/10 p-3">
              <Target className="h-6 w-6 text-primary" />
            </div>
            <p className="font-semibold">
              {habits.length === 0 ? "No habits yet" : "Nothing here"}
            </p>
            <p className="text-xs text-muted-foreground">
              {habits.length === 0 ? "Create your first habit to start tracking." : "Try a different filter."}
            </p>
            {habits.length === 0 && (
              <Button size="sm" onClick={() => setDialogOpen(true)} className="mt-2 gap-1.5">
                <Plus className="h-4 w-4" /> Create habit
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((h) => <HabitCard key={h.id} habit={h} logs={logs} />)}
          </AnimatePresence>
        </div>
      )}

      <HabitDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </section>
  );
}

function StatCard({ icon: Icon, label, value, tone }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
      <Card className={cn("border-border/60 bg-gradient-to-br", tone)}>
        <CardContent className="flex items-center gap-2.5 p-3">
          <Icon className="h-5 w-5 text-foreground/70" />
          <div>
            <div className="text-lg font-bold leading-none">{value}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
