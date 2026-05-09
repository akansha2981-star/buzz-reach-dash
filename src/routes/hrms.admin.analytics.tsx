import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, eachDayOfInterval, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { Users, Clock, CalendarDays, ListChecks, TrendingUp, Download, BarChart3 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { HRShell } from "@/components/hr/HRShell";
import { useMyEmployee, isHRAdminRole } from "@/lib/hr";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/hrms/admin/analytics")({
  component: () => <HRShell title="HR Analytics"><AnalyticsPage /></HRShell>,
});

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

function AnalyticsPage() {
  const { data: me } = useMyEmployee();
  const [range, setRange] = useState<"30" | "60" | "90">("30");
  const days = parseInt(range);
  const fromDate = format(subDays(new Date(), days - 1), "yyyy-MM-dd");
  const toDate = format(new Date(), "yyyy-MM-dd");

  const { data: stats } = useQuery({
    queryKey: ["hr-analytics", range],
    enabled: !!me && isHRAdminRole(me.hr_role),
    queryFn: async () => {
      const [emps, att, leaves, tasks, logs] = await Promise.all([
        supabase.from("hr_employees").select("id, hr_role, status, department_id"),
        supabase.from("hr_attendance").select("work_date, status, total_work_minutes, employee_id").gte("work_date", fromDate).lte("work_date", toDate),
        supabase.from("hr_leave_requests").select("id, status, days, leave_type_id, from_date, created_at").gte("created_at", fromDate),
        supabase.from("hr_tasks").select("id, status, priority, completed_at, created_at"),
        supabase.from("hr_work_logs").select("work_date, hours, employee_id").gte("work_date", fromDate).lte("work_date", toDate),
      ]);
      return {
        employees: emps.data ?? [],
        attendance: att.data ?? [],
        leaves: leaves.data ?? [],
        tasks: tasks.data ?? [],
        worklogs: logs.data ?? [],
      };
    },
  });

  const kpis = useMemo(() => {
    if (!stats) return null;
    const activeEmp = stats.employees.filter((e: any) => e.status === "active").length;
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const todayAtt = stats.attendance.filter((a: any) => a.work_date === todayStr);
    const presentToday = todayAtt.filter((a: any) => ["present", "late", "wfh", "half_day"].includes(a.status)).length;
    const pendingLeaves = stats.leaves.filter((l: any) => l.status === "pending").length;
    const openTasks = stats.tasks.filter((t: any) => !["done", "cancelled"].includes(t.status)).length;
    const overdueTasks = stats.tasks.filter((t: any) => !["done", "cancelled"].includes(t.status)).length;
    const avgHours = stats.worklogs.length
      ? (stats.worklogs.reduce((s: number, l: any) => s + Number(l.hours), 0) / stats.worklogs.length).toFixed(1)
      : "0";
    return { activeEmp, presentToday, pendingLeaves, openTasks, overdueTasks, avgHours };
  }, [stats]);

  const dayBuckets = useMemo(() => {
    if (!stats) return [];
    const list = eachDayOfInterval({ start: parseISO(fromDate), end: parseISO(toDate) });
    return list.map((d) => {
      const ds = format(d, "yyyy-MM-dd");
      const att = stats.attendance.filter((a: any) => a.work_date === ds);
      const present = att.filter((a: any) => ["present", "late", "wfh"].includes(a.status)).length;
      const absent = att.filter((a: any) => a.status === "absent").length;
      const onLeave = att.filter((a: any) => a.status === "leave").length;
      const hours = stats.worklogs.filter((w: any) => w.work_date === ds).reduce((s: number, w: any) => s + Number(w.hours), 0);
      return { date: format(d, "MMM d"), iso: ds, present, absent, onLeave, hours: +hours.toFixed(1) };
    });
  }, [stats, fromDate, toDate]);

  const taskStatusData = useMemo(() => {
    if (!stats) return [];
    const map: Record<string, number> = {};
    stats.tasks.forEach((t: any) => { map[t.status] = (map[t.status] ?? 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [stats]);

  const leaveStatusData = useMemo(() => {
    if (!stats) return [];
    const map: Record<string, number> = {};
    stats.leaves.forEach((l: any) => { map[l.status] = (map[l.status] ?? 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [stats]);

  // Heatmap: present count per day in current month
  const heatmap = useMemo(() => {
    if (!stats) return [];
    const start = startOfMonth(new Date());
    const end = endOfMonth(new Date());
    const days = eachDayOfInterval({ start, end });
    const max = Math.max(1, ...stats.employees.filter((e: any) => e.status === "active").map(() => 1)) * stats.employees.length;
    return days.map((d) => {
      const ds = format(d, "yyyy-MM-dd");
      const present = stats.attendance.filter((a: any) => a.work_date === ds && ["present", "late", "wfh", "half_day"].includes(a.status)).length;
      return { iso: ds, day: d.getDate(), dow: d.getDay(), present, intensity: Math.min(1, present / Math.max(1, stats.employees.filter((e: any) => e.status === "active").length)) };
    });
  }, [stats]);

  const exportCSV = () => {
    const rows = [["Date", "Present", "Absent", "On Leave", "Total Hours"], ...dayBuckets.map((d) => [d.iso, d.present, d.absent, d.onLeave, d.hours])];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `hr-analytics-${range}d.csv`; a.click(); URL.revokeObjectURL(url);
  };

  if (me && !isHRAdminRole(me.hr_role)) {
    return <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Admins only.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold">HR Analytics</h1>
          <p className="text-sm text-muted-foreground">Workforce insights for the last {range} days</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={(v) => setRange(v as any)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="60">Last 60 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="mr-1 h-4 w-4" />CSV</Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi icon={Users} label="Active Employees" value={kpis?.activeEmp ?? "—"} />
        <Kpi icon={Clock} label="Present Today" value={kpis?.presentToday ?? "—"} />
        <Kpi icon={CalendarDays} label="Pending Leaves" value={kpis?.pendingLeaves ?? "—"} tone="warn" />
        <Kpi icon={ListChecks} label="Open Tasks" value={kpis?.openTasks ?? "—"} />
        <Kpi icon={TrendingUp} label="Avg Hours/Log" value={kpis?.avgHours ?? "—"} />
        <Kpi icon={BarChart3} label="Days Tracked" value={dayBuckets.length} />
      </div>

      {/* Attendance trend */}
      <Card>
        <CardHeader><CardTitle className="text-base">Attendance Trend</CardTitle></CardHeader>
        <CardContent className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dayBuckets}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="present" stackId="a" fill="#10b981" name="Present" />
              <Bar dataKey="onLeave" stackId="a" fill="#f59e0b" name="On Leave" />
              <Bar dataKey="absent" stackId="a" fill="#ef4444" name="Absent" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Productivity hours line */}
        <Card>
          <CardHeader><CardTitle className="text-base">Productivity Hours</CardTitle></CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dayBuckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Line type="monotone" dataKey="hours" stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Task status pie */}
        <Card>
          <CardHeader><CardTitle className="text-base">Task Status</CardTitle></CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={taskStatusData} dataKey="value" nameKey="name" outerRadius={80} label>
                  {taskStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Leaves status */}
        <Card>
          <CardHeader><CardTitle className="text-base">Leave Requests</CardTitle></CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={leaveStatusData} dataKey="value" nameKey="name" outerRadius={80} label>
                  {leaveStatusData.map((_, i) => <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Heatmap */}
        <Card>
          <CardHeader><CardTitle className="text-base">Attendance Heatmap — {format(new Date(), "MMMM yyyy")}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px]">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="font-medium text-muted-foreground">{d}</div>)}
              {Array.from({ length: heatmap[0]?.dow ?? 0 }).map((_, i) => <div key={`pad-${i}`} />)}
              {heatmap.map((d) => (
                <div
                  key={d.iso}
                  title={`${d.iso}: ${d.present} present`}
                  className={cn("aspect-square rounded-md flex items-center justify-center text-[10px] font-medium border")}
                  style={{
                    background: d.intensity > 0
                      ? `color-mix(in oklab, hsl(var(--primary)) ${Math.round(d.intensity * 90)}%, transparent)`
                      : "hsl(var(--muted))",
                    color: d.intensity > 0.4 ? "white" : "hsl(var(--foreground))",
                  }}
                >
                  {d.day}
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>Less</span>
              {[0.1, 0.3, 0.5, 0.7, 0.9].map((i) => (
                <div key={i} className="h-3 w-5 rounded" style={{ background: `color-mix(in oklab, hsl(var(--primary)) ${i * 90}%, transparent)` }} />
              ))}
              <span>More</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: any; label: string; value: any; tone?: "warn" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <Icon className={cn("h-4 w-4", tone === "warn" ? "text-amber-500" : "text-muted-foreground")} />
          {tone === "warn" && Number(value) > 0 && <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">Action</Badge>}
        </div>
        <div className="mt-2 text-2xl font-bold tabular-nums">{value}</div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
