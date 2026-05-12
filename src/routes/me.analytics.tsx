import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MeShell } from "@/components/me/MeShell";
import { useMyTasks, useFocusSessions, deriveStatus } from "@/lib/me";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { addDays, format } from "date-fns";

export const Route = createFileRoute("/me/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { data: tasks = [] } = useMyTasks();
  const { data: focus = [] } = useFocusSessions(30);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const overdue = tasks.filter((t) => deriveStatus(t) === "overdue").length;
    const pending = total - completed;
    const pct = total ? Math.round((completed / total) * 100) : 0;
    return { total, completed, overdue, pending, pct };
  }, [tasks]);

  const weekData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = format(addDays(new Date(), -6 + i), "yyyy-MM-dd");
      const completed = tasks.filter((t) => t.completed_at?.slice(0, 10) === d).length;
      const focusMin = focus.filter((s: any) => s.started_at?.slice(0, 10) === d).reduce((a: number, s: any) => a + (s.duration_minutes || 0), 0);
      return { day: format(addDays(new Date(), -6 + i), "EEE"), completed, focus: focusMin };
    });
  }, [tasks, focus]);

  const heatmap = useMemo(() => {
    return Array.from({ length: 35 }, (_, i) => {
      const d = format(addDays(new Date(), -34 + i), "yyyy-MM-dd");
      const c = tasks.filter((t) => t.completed_at?.slice(0, 10) === d).length;
      return { date: d, count: c };
    });
  }, [tasks]);

  return (
    <MeShell title="Analytics" subtitle="Your productivity, visualized.">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Total tasks" value={stats.total} />
        <Stat label="Completed" value={stats.completed} tone="text-emerald-600 dark:text-emerald-400" />
        <Stat label="Pending" value={stats.pending} tone="text-amber-600 dark:text-amber-400" />
        <Stat label="Overdue" value={stats.overdue} tone="text-rose-600 dark:text-rose-400" />
        <Stat label="Completion %" value={`${stats.pct}%`} tone="text-primary" />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Last 7 days</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="day" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip />
              <Bar dataKey="completed" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} name="Tasks done" />
              <Bar dataKey="focus" fill="hsl(var(--primary-glow, var(--primary)))" radius={[6, 6, 0, 0]} name="Focus min" opacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Activity heatmap · 35 days</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-[repeat(35,minmax(0,1fr))]">
            {heatmap.map((c) => {
              const lvl = c.count === 0 ? 0 : c.count < 2 ? 1 : c.count < 4 ? 2 : c.count < 7 ? 3 : 4;
              const tones = [
                "bg-muted/40",
                "bg-primary/20",
                "bg-primary/40",
                "bg-primary/70",
                "bg-primary",
              ];
              return <div key={c.date} className={`aspect-square rounded ${tones[lvl]}`} title={`${c.date}: ${c.count} done`} />;
            })}
          </div>
          <div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
            Less <span className="ml-1 h-3 w-3 rounded bg-muted/40" /><span className="h-3 w-3 rounded bg-primary/20" /><span className="h-3 w-3 rounded bg-primary/40" /><span className="h-3 w-3 rounded bg-primary/70" /><span className="h-3 w-3 rounded bg-primary" /> More
          </div>
        </CardContent>
      </Card>
    </MeShell>
  );
}

function Stat({ label, value, tone = "" }: { label: string; value: number | string; tone?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`mt-1 font-display text-2xl font-bold ${tone}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
