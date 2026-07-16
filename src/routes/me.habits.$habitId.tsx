import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Flame, Trophy, Target, TrendingUp, Calendar as CalIcon, Edit3, Check } from "lucide-react";
import { MeShell } from "@/components/me/MeShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, BarChart, Bar, CartesianGrid } from "recharts";
import { format, addDays, parseISO } from "date-fns";
import {
  useHabit,
  useHabitFields,
  useHabitLogsAdv,
  currentStreak,
  longestStreak,
  completionRate,
  isDueOn,
  FIELD_TYPE_META,
} from "@/lib/habits";
import { CheckInDialog } from "@/components/habits/CheckInDialog";
import { HabitDialog } from "@/components/habits/HabitDialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/me/habits/$habitId")({
  component: HabitDetail,
});

function HabitDetail() {
  const { habitId } = Route.useParams();
  const { data: habit } = useHabit(habitId);
  const { data: fields = [] } = useHabitFields(habitId);
  const { data: logs = [] } = useHabitLogsAdv(habitId, 180);
  const [checkIn, setCheckIn] = useState<{ open: boolean; date?: string }>({ open: false });
  const [edit, setEdit] = useState(false);

  if (!habit) {
    return (
      <MeShell title="Habit">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </MeShell>
    );
  }

  const streak = currentStreak(habit, logs);
  const longest = longestStreak(habit, logs);
  const rate30 = completionRate(habit, logs, 30);
  const total = logs.filter((l) => l.done).length;

  // 30-day timeline
  const timeline = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const d = addDays(new Date(), -29 + i);
      const key = format(d, "yyyy-MM-dd");
      const log = logs.find((l) => l.log_date === key);
      return {
        date: format(d, "MM-dd"),
        key,
        done: log?.done ? 1 : 0,
        values: log?.values ?? {},
      };
    });
  }, [logs]);

  // Milestones
  const milestones = useMemo(() => {
    const marks = [7, 14, 30, 60, 100, 365];
    return marks.map((m) => ({ m, hit: longest >= m }));
  }, [longest]);

  return (
    <MeShell title={`${habit.icon || "✨"} ${habit.title}`} subtitle={`${habit.category ?? "Habit summary"} · ${habit.frequency}`}>
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="gap-1">
          <Link to="/me/habits"><ArrowLeft className="h-4 w-4" /> Back</Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEdit(true)} className="gap-1.5">
            <Edit3 className="h-3.5 w-3.5" /> Edit
          </Button>
          <Button size="sm" onClick={() => setCheckIn({ open: true })} className="gap-1.5 bg-gradient-to-br from-emerald-500 to-emerald-600">
            <Check className="h-3.5 w-3.5" /> Check in
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryStat icon={Flame} label="Current streak" value={streak} tone="from-amber-500/20 to-amber-500/5" accent="text-amber-600" />
        <SummaryStat icon={Trophy} label="Longest streak" value={longest} tone="from-orange-500/20 to-orange-500/5" accent="text-orange-600" />
        <SummaryStat icon={TrendingUp} label="30-day rate" value={`${rate30}%`} tone="from-primary/20 to-primary/5" accent="text-primary" />
        <SummaryStat icon={Target} label="Total done" value={total} tone="from-emerald-500/20 to-emerald-500/5" accent="text-emerald-600" />
      </div>

      {/* Completion trend */}
      <Card>
        <CardContent className="p-4">
          <p className="mb-2 text-sm font-semibold">Last 30 days</p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis hide domain={[0, 1]} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Bar dataKey="done" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Milestones */}
      <Card>
        <CardContent className="p-4">
          <p className="mb-3 text-sm font-semibold">Milestones</p>
          <div className="flex flex-wrap gap-2">
            {milestones.map(({ m, hit }) => (
              <div
                key={m}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
                  hit
                    ? "border-amber-500/50 bg-gradient-to-br from-amber-500/20 to-amber-500/5 text-amber-700 dark:text-amber-300"
                    : "border-border/60 bg-muted/40 text-muted-foreground"
                )}
              >
                <Trophy className={cn("h-3.5 w-3.5", hit && "text-amber-500")} /> {m}-day
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Per-field analytics */}
      {fields.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <p className="text-sm font-semibold">Tracked values</p>
            {fields.map((f) => {
              const nums = logs
                .filter((l) => l.done && l.values && l.values[f.key] != null && l.values[f.key] !== "")
                .map((l) => ({
                  date: format(parseISO(l.log_date), "MM-dd"),
                  key: l.log_date,
                  value: Number(l.values[f.key]) || 0,
                }))
                .sort((a, b) => a.key.localeCompare(b.key));

              const avg = nums.length ? nums.reduce((s, x) => s + x.value, 0) / nums.length : 0;
              const best = nums.length ? Math.max(...nums.map((x) => x.value)) : 0;
              const totalV = nums.reduce((s, x) => s + x.value, 0);
              const targetHits = f.target_value != null
                ? nums.filter((x) => x.value >= (f.target_value ?? 0)).length
                : 0;
              const hitPct = nums.length && f.target_value != null
                ? Math.round((targetHits / nums.length) * 100) : null;

              return (
                <div key={f.id} className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">
                        {FIELD_TYPE_META[f.type].icon} {f.label}
                        {f.unit && <span className="ml-1 text-xs text-muted-foreground">({f.unit})</span>}
                      </p>
                      {f.target_value != null && (
                        <p className="text-[10px] text-muted-foreground">Target: {f.target_value}{f.unit ? ` ${f.unit}` : ""} / {f.target_period}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      <Mini label="Avg" v={avg.toFixed(1)} />
                      <Mini label="Best" v={best} />
                      <Mini label="Total" v={totalV.toFixed(1)} />
                      {hitPct != null && <Mini label="Target hit" v={`${hitPct}%`} />}
                    </div>
                  </div>
                  {nums.length > 0 && (
                    <div className="h-28">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={nums}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                          <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardContent className="p-4">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><CalIcon className="h-4 w-4" /> History</p>
          {logs.length === 0 ? (
            <p className="text-xs text-muted-foreground">No entries yet.</p>
          ) : (
            <div className="max-h-96 divide-y overflow-y-auto rounded-lg border border-border/60">
              {logs.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setCheckIn({ open: true, date: l.log_date })}
                  className="flex w-full items-center justify-between p-2.5 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-center gap-2">
                    <div className={cn("h-2 w-2 rounded-full", l.done ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                    <span className="text-sm font-medium">{format(parseISO(l.log_date), "EEE, MMM d")}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {fields.map((f) => {
                      const v = l.values?.[f.key];
                      if (v == null || v === "") return null;
                      return (
                        <span key={f.id} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
                          {f.label}: {v}{f.unit ? ` ${f.unit}` : ""}
                        </span>
                      );
                    })}
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CheckInDialog open={checkIn.open} onOpenChange={(o) => setCheckIn({ open: o })} habit={habit} logDate={checkIn.date} />
      <HabitDialog open={edit} onOpenChange={setEdit} habit={habit} />
    </MeShell>
  );
}

function SummaryStat({ icon: Icon, label, value, tone, accent }: any) {
  return (
    <Card className={cn("border-border/60 bg-gradient-to-br", tone)}>
      <CardContent className="flex items-center gap-2.5 p-3">
        <Icon className={cn("h-5 w-5", accent)} />
        <div>
          <div className="text-xl font-bold leading-none">{value}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Mini({ label, v }: { label: string; v: any }) {
  return (
    <span className="rounded bg-background/60 px-1.5 py-0.5">
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-semibold">{v}</span>
    </span>
  );
}
