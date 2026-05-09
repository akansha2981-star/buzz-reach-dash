import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, subDays } from "date-fns";
import { Plus, TrendingUp, Calendar, Smile, Meh, Frown, Zap, Coffee, AlertCircle, CheckCircle2 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { HRShell } from "@/components/hr/HRShell";
import { useMyEmployee, todayISO } from "@/lib/hr";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/hrms/productivity")({
  component: () => <HRShell title="Productivity"><ProductivityPage /></HRShell>,
});

const MOODS = [
  { value: "great", label: "Great", icon: Smile, color: "text-emerald-500" },
  { value: "good", label: "Good", icon: Smile, color: "text-blue-500" },
  { value: "okay", label: "Okay", icon: Meh, color: "text-amber-500" },
  { value: "tough", label: "Tough", icon: Frown, color: "text-rose-500" },
];

function ProductivityPage() {
  const { data: me } = useMyEmployee();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editDate, setEditDate] = useState<string>(todayISO());

  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

  const { data: logs = [] } = useQuery({
    queryKey: ["hr-worklogs", me?.id, monthStart],
    enabled: !!me,
    queryFn: async () => {
      const { data } = await supabase.from("hr_work_logs").select("*")
        .eq("employee_id", me!.id).gte("work_date", monthStart).lte("work_date", monthEnd)
        .order("work_date", { ascending: false });
      return data ?? [];
    },
  });

  const chartData = useMemo(() => {
    const days = eachDayOfInterval({ start: subDays(new Date(), 13), end: new Date() });
    return days.map((d) => {
      const iso = format(d, "yyyy-MM-dd");
      const log = logs.find((l: any) => l.work_date === iso);
      return { date: format(d, "MMM d"), hours: Number(log?.hours ?? 0) };
    });
  }, [logs]);

  const totalHours = logs.reduce((s: number, l: any) => s + Number(l.hours), 0);
  const avgHours = logs.length ? (totalHours / logs.length).toFixed(1) : "0";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Calendar} label="Logged Days (mo)" value={String(logs.length)} tone="text-blue-500" />
        <StatCard icon={TrendingUp} label="Total Hours" value={totalHours.toFixed(1)} tone="text-emerald-500" />
        <StatCard icon={Zap} label="Avg / Day" value={avgHours} tone="text-purple-500" />
        <StatCard icon={CheckCircle2} label="Streak" value={String(streak(logs))} tone="text-amber-500" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Last 14 days</CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => setEditDate(todayISO())}><Plus className="h-4 w-4" /> Log Today</Button>
            </DialogTrigger>
            <WorkLogDialog
              date={editDate}
              existing={logs.find((l: any) => l.work_date === editDate)}
              onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["hr-worklogs"] }); }}
            />
          </Dialog>
        </CardHeader>
        <CardContent className="h-56 p-0 pb-2 pr-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
              <XAxis dataKey="date" fontSize={10} stroke="currentColor" className="text-muted-foreground" />
              <YAxis fontSize={10} stroke="currentColor" className="text-muted-foreground" />
              <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Recent Logs</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {logs.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No work logs this month yet. Click "Log Today" to start.</div>
          ) : logs.map((log: any) => {
            const moodCfg = MOODS.find((m) => m.value === log.mood);
            const MoodIcon = moodCfg?.icon ?? Meh;
            return (
              <div key={log.id} className="group rounded-xl border bg-card p-3 transition-colors hover:bg-muted/30">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{format(new Date(log.work_date), "MMM dd, EEE")}</Badge>
                    <Badge variant="secondary"><Coffee className="mr-1 h-3 w-3" />{log.hours}h</Badge>
                    {moodCfg && <MoodIcon className={cn("h-4 w-4", moodCfg.color)} />}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => { setEditDate(log.work_date); setOpen(true); }}>Edit</Button>
                </div>
                <p className="mt-2 text-sm">{log.summary}</p>
                {log.accomplishments && <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="mr-1 inline h-3 w-3" />{log.accomplishments}</p>}
                {log.blockers && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400"><AlertCircle className="mr-1 inline h-3 w-3" />{log.blockers}</p>}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function streak(logs: any[]) {
  let s = 0;
  for (let i = 0; i < 30; i++) {
    const d = format(subDays(new Date(), i), "yyyy-MM-dd");
    if (logs.find((l) => l.work_date === d)) s++;
    else if (i > 0) break;
  }
  return s;
}

function StatCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: string }) {
  return (
    <Card><CardContent className="flex items-center gap-3 p-4">
      <Icon className={cn("h-5 w-5", tone)} />
      <div><div className="text-xs text-muted-foreground">{label}</div><div className={cn("font-display text-xl font-bold", tone)}>{value}</div></div>
    </CardContent></Card>
  );
}

function WorkLogDialog({ date, existing, onClose }: { date: string; existing: any; onClose: () => void }) {
  const { data: me } = useMyEmployee();
  const [form, setForm] = useState({
    work_date: existing?.work_date ?? date,
    hours: existing?.hours ?? 8,
    summary: existing?.summary ?? "",
    accomplishments: existing?.accomplishments ?? "",
    blockers: existing?.blockers ?? "",
    mood: existing?.mood ?? "good",
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!me) throw new Error("No profile");
      const payload = { ...form, employee_id: me.id, hours: Number(form.hours) };
      const { error } = await supabase.from("hr_work_logs").upsert(payload, { onConflict: "employee_id,work_date" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Work log saved"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader><DialogTitle>Daily Work Log</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label className="text-xs">Date</Label><Input type="date" value={form.work_date} onChange={(e) => setForm({ ...form, work_date: e.target.value })} /></div>
        <div className="space-y-1"><Label className="text-xs">Hours</Label><Input type="number" step="0.5" min="0" max="24" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value as any })} /></div>
        <div className="col-span-2 space-y-1"><Label className="text-xs">Summary *</Label><Textarea rows={3} maxLength={1000} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="What did you work on today?" /></div>
        <div className="col-span-2 space-y-1"><Label className="text-xs">Accomplishments</Label><Textarea rows={2} maxLength={500} value={form.accomplishments} onChange={(e) => setForm({ ...form, accomplishments: e.target.value })} /></div>
        <div className="col-span-2 space-y-1"><Label className="text-xs">Blockers</Label><Textarea rows={2} maxLength={500} value={form.blockers} onChange={(e) => setForm({ ...form, blockers: e.target.value })} /></div>
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Mood</Label>
          <div className="flex gap-2">
            {MOODS.map((m) => {
              const Icon = m.icon;
              const active = form.mood === m.value;
              return (
                <button key={m.value} type="button" onClick={() => setForm({ ...form, mood: m.value })}
                  className={cn("flex flex-1 flex-col items-center gap-1 rounded-lg border px-3 py-2 text-xs transition-colors", active ? "border-primary bg-primary/10" : "hover:bg-muted")}>
                  <Icon className={cn("h-5 w-5", m.color)} />{m.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => save.mutate()} disabled={!form.summary.trim() || save.isPending}>{save.isPending ? "Saving…" : "Save Log"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
