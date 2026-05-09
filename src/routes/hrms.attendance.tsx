import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { Clock, Play, StopCircle, Coffee, CheckCircle2, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { HRShell } from "@/components/hr/HRShell";
import { useMyEmployee, todayISO, fmtMinutes } from "@/lib/hr";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/hrms/attendance")({
  component: () => <HRShell title="My Attendance"><AttendancePage /></HRShell>,
});

function AttendancePage() {
  const { data: me } = useMyEmployee();
  const qc = useQueryClient();
  const [note, setNote] = useState("");

  const { data: today, refetch: refetchToday } = useQuery({
    queryKey: ["hr-att-today", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const { data } = await supabase
        .from("hr_attendance").select("*, breaks:hr_breaks(*)")
        .eq("employee_id", me!.id).eq("work_date", todayISO()).maybeSingle();
      return data;
    },
  });

  const { data: monthAtt = [] } = useQuery({
    queryKey: ["hr-att-month", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const start = startOfMonth(new Date()).toISOString().slice(0, 10);
      const end = endOfMonth(new Date()).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("hr_attendance").select("*").eq("employee_id", me!.id)
        .gte("work_date", start).lte("work_date", end).order("work_date", { ascending: false });
      return data ?? [];
    },
  });

  const openBreak = today?.breaks?.find((b: any) => !b.end_at);

  const clockIn = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const { error } = await supabase.from("hr_attendance").insert({
        employee_id: me!.id,
        work_date: todayISO(),
        clock_in_at: now.toISOString(),
        status: now.getHours() >= 10 ? "late" : "present",
        notes: note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { setNote(""); toast.success("Clocked in"); refetchToday(); qc.invalidateQueries({ queryKey: ["hr-att-month", me?.id] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const clockOut = useMutation({
    mutationFn: async () => {
      if (!today) throw new Error("Not clocked in");
      const now = new Date();
      const inTime = new Date(today.clock_in_at);
      const totalMin = Math.round((now.getTime() - inTime.getTime()) / 60000);
      const breakMin = (today.breaks ?? []).reduce((s: number, b: any) => {
        if (b.end_at) return s + Math.round((new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / 60000);
        return s;
      }, 0);
      const work = Math.max(totalMin - breakMin, 0);
      const status = work < 240 ? "half_day" : today.status;
      const { error } = await supabase.from("hr_attendance").update({
        clock_out_at: now.toISOString(),
        total_work_minutes: work,
        total_break_minutes: breakMin,
        status,
      }).eq("id", today.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Clocked out"); refetchToday(); qc.invalidateQueries({ queryKey: ["hr-att-month", me?.id] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const startBreak = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("hr_breaks").insert({ attendance_id: today!.id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Break started"); refetchToday(); },
    onError: (e: any) => toast.error(e.message),
  });

  const endBreak = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("hr_breaks").update({ end_at: new Date().toISOString() }).eq("id", openBreak.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Break ended"); refetchToday(); },
    onError: (e: any) => toast.error(e.message),
  });

  // monthly grid
  const days = useMemo(() => eachDayOfInterval({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) }), []);
  const dayMap = useMemo(() => {
    const m = new Map<string, any>();
    monthAtt.forEach((a: any) => m.set(a.work_date, a));
    return m;
  }, [monthAtt]);

  if (!me) return null;

  const liveBreakMin = openBreak ? Math.round((Date.now() - new Date(openBreak.start_at).getTime()) / 60000) : 0;
  const inProgressWork = today?.clock_in_at && !today?.clock_out_at
    ? Math.round((Date.now() - new Date(today.clock_in_at).getTime()) / 60000) - (today.breaks ?? []).reduce((s: number, b: any) => s + (b.end_at ? Math.round((new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / 60000) : 0), 0) - liveBreakMin
    : 0;

  return (
    <div className="space-y-4">
      {/* Today widget */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4" /> Today · {format(new Date(), "EEE, MMM d")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Clock-in" value={today?.clock_in_at ? format(new Date(today.clock_in_at), "p") : "—"} />
            <Stat label="Clock-out" value={today?.clock_out_at ? format(new Date(today.clock_out_at), "p") : "—"} />
            <Stat label="Work time" value={today?.clock_out_at ? fmtMinutes(today.total_work_minutes) : today ? fmtMinutes(Math.max(inProgressWork, 0)) : "—"} />
            <Stat label="Breaks" value={today ? fmtMinutes((today.total_break_minutes ?? 0) + liveBreakMin) : "—"} />
          </div>

          {!today ? (
            <div className="space-y-2">
              <Textarea placeholder="Optional note for today (e.g. Working from office)" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
              <Button className="w-full sm:w-auto" disabled={clockIn.isPending} onClick={() => clockIn.mutate()}>
                <Play className="mr-1 h-4 w-4" /> Clock In
              </Button>
            </div>
          ) : today.clock_out_at ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" /> Day complete. Worked {fmtMinutes(today.total_work_minutes)} ({today.status}).
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {!openBreak ? (
                <Button variant="outline" disabled={startBreak.isPending} onClick={() => startBreak.mutate()}>
                  <Coffee className="mr-1 h-4 w-4" /> Start break
                </Button>
              ) : (
                <Button variant="outline" disabled={endBreak.isPending} onClick={() => endBreak.mutate()}>
                  <Coffee className="mr-1 h-4 w-4" /> End break ({liveBreakMin}m)
                </Button>
              )}
              <Button variant="destructive" disabled={clockOut.isPending || !!openBreak} onClick={() => clockOut.mutate()}>
                <StopCircle className="mr-1 h-4 w-4" /> Clock Out
              </Button>
              {openBreak && <span className="self-center text-xs text-muted-foreground">End break before clocking out</span>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Month grid */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><Calendar className="h-4 w-4" /> {format(new Date(), "MMMM yyyy")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] uppercase text-muted-foreground">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i}>{d}</div>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1.5">
            {Array.from({ length: days[0].getDay() }).map((_, i) => <div key={`pad-${i}`} />)}
            {days.map((d) => {
              const att = dayMap.get(d.toISOString().slice(0, 10));
              const isToday = isSameDay(d, new Date());
              const tone = att?.status === "absent" ? "bg-destructive/10 border-destructive/40 text-destructive"
                : att?.status === "late" ? "bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300"
                : att?.status === "half_day" ? "bg-orange-500/10 border-orange-500/40 text-orange-700 dark:text-orange-300"
                : att?.status === "wfh" ? "bg-purple-500/10 border-purple-500/40 text-purple-700 dark:text-purple-300"
                : att ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                : "bg-muted/30 border-border text-muted-foreground";
              return (
                <div key={d.toISOString()} className={cn("aspect-square rounded-md border p-1 text-[11px]", tone, isToday && "ring-2 ring-primary")} title={att?.status ?? "no record"}>
                  <div className="font-semibold">{d.getDate()}</div>
                  {att && <div className="mt-0.5 text-[9px] opacity-80">{fmtMinutes(att.total_work_minutes)}</div>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">History</CardTitle></CardHeader>
        <CardContent>
          {monthAtt.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">No records this month yet.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr><th className="py-2">Date</th><th>In</th><th>Out</th><th>Work</th><th>Break</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {monthAtt.map((a: any) => (
                    <tr key={a.id} className="border-t">
                      <td className="py-2">{format(new Date(a.work_date), "EEE d MMM")}</td>
                      <td>{a.clock_in_at ? format(new Date(a.clock_in_at), "p") : "—"}</td>
                      <td>{a.clock_out_at ? format(new Date(a.clock_out_at), "p") : "—"}</td>
                      <td>{fmtMinutes(a.total_work_minutes)}</td>
                      <td>{fmtMinutes(a.total_break_minutes)}</td>
                      <td><Badge variant="outline" className="text-[10px] capitalize">{a.status.replace("_", " ")}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold">{value}</p>
    </div>
  );
}
