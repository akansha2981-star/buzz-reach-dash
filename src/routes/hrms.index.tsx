import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Clock, CalendarDays, TrendingUp, FileText, Briefcase, Building2, UserCircle,
  CheckCircle2, AlertCircle, Plane,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { HRShell, HRRoleBadge } from "@/components/hr/HRShell";
import { useMyEmployee, useDepartments, fmtMinutes, todayISO } from "@/lib/hr";

export const Route = createFileRoute("/hrms/")({
  component: () => <HRShell title="HR Dashboard"><HRDashboard /></HRShell>,
});

function HRDashboard() {
  const { data: me } = useMyEmployee();
  const { data: departments = [] } = useDepartments();
  const dept = departments.find((d) => d.id === me?.department_id);

  const { data: manager } = useQuery({
    queryKey: ["hr-manager", me?.reporting_manager_id],
    enabled: !!me?.reporting_manager_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("hr_employees").select("id, full_name, designation").eq("id", me!.reporting_manager_id!).maybeSingle();
      return data;
    },
  });

  const { data: today } = useQuery({
    queryKey: ["hr-today", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const { data } = await supabase
        .from("hr_attendance").select("*").eq("employee_id", me!.id).eq("work_date", todayISO()).maybeSingle();
      return data;
    },
  });

  const { data: monthAtt = [] } = useQuery({
    queryKey: ["hr-month-att", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const start = new Date(); start.setDate(1);
      const { data } = await supabase
        .from("hr_attendance").select("status,total_work_minutes,work_date")
        .eq("employee_id", me!.id).gte("work_date", start.toISOString().slice(0, 10));
      return data ?? [];
    },
  });

  const { data: leaves = [] } = useQuery({
    queryKey: ["hr-leaves-summary", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const year = new Date().getFullYear();
      const { data } = await supabase
        .from("hr_leave_balances")
        .select("allocated, used, leave_type:leave_type_id (name, code, color)")
        .eq("employee_id", me!.id).eq("year", year);
      return data ?? [];
    },
  });

  const { data: pendingLeaves = 0 } = useQuery({
    queryKey: ["hr-pending-leaves", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const { count } = await supabase
        .from("hr_leave_requests").select("id", { head: true, count: "exact" })
        .eq("employee_id", me!.id).in("status", ["pending", "manager_approved"]);
      return count ?? 0;
    },
  });

  if (!me) return null;

  const presentDays = monthAtt.filter((d: any) => ["present", "wfh", "late", "half_day"].includes(d.status)).length;
  const totalDays = monthAtt.length || 1;
  const attendancePct = Math.round((presentDays / totalDays) * 100);
  const totalLeaves = leaves.reduce((s: number, l: any) => s + Number(l.allocated || 0), 0);
  const usedLeaves = leaves.reduce((s: number, l: any) => s + Number(l.used || 0), 0);
  const remaining = Math.max(totalLeaves - usedLeaves, 0);

  return (
    <div className="space-y-4">
      {/* Welcome card */}
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground shadow-lg">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
                <UserCircle className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide opacity-80">Welcome back</p>
                <h2 className="font-display text-xl font-bold sm:text-2xl truncate">{me.full_name}</h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs opacity-95">
                  {me.employee_code && <Badge variant="secondary" className="bg-white/20 text-white border-0">#{me.employee_code}</Badge>}
                  <HRRoleBadge role={me.hr_role} />
                  {me.designation && <span>· {me.designation}</span>}
                  {dept && <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" /> {dept.name}</span>}
                </div>
                {(me.joining_date || manager) && (
                  <p className="mt-2 text-xs opacity-80">
                    {me.joining_date && <>Joined {format(new Date(me.joining_date), "PP")}</>}
                    {manager && <> · Reports to <strong>{manager.full_name}</strong></>}
                  </p>
                )}
              </div>
            </div>
            <Button asChild variant="secondary" size="sm" className="shrink-0">
              <Link to="/hrms/attendance">{today?.clock_in_at && !today?.clock_out_at ? "End work day" : "Start work day"}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stat cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Clock className="h-4 w-4 text-blue-500" />}
          label="Today"
          value={today?.clock_in_at ? format(new Date(today.clock_in_at), "p") : "—"}
          sub={today?.clock_out_at ? `Out ${format(new Date(today.clock_out_at), "p")}` : today?.clock_in_at ? "In progress" : "Not clocked in"}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
          label="Attendance %"
          value={`${attendancePct}%`}
          sub={`${presentDays}/${totalDays} days this month`}
        />
        <StatCard
          icon={<Plane className="h-4 w-4 text-purple-500" />}
          label="Leaves remaining"
          value={remaining.toFixed(1)}
          sub={`${usedLeaves}/${totalLeaves} used`}
        />
        <StatCard
          icon={<AlertCircle className="h-4 w-4 text-amber-500" />}
          label="Pending"
          value={pendingLeaves}
          sub="leave requests"
        />
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Quick actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <QuickAction to="/hrms/attendance" icon={Clock} label="Attendance" />
          <QuickAction to="/hrms/leaves" icon={CalendarDays} label="Apply Leave" />
          <QuickAction to="/hrms/employees" icon={Briefcase} label="Directory" />
          <QuickAction to={`/hrms/employees/${me.id}`} icon={FileText} label="My Profile" />
        </CardContent>
      </Card>

      {/* Leave balances */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm"><Plane className="h-4 w-4" /> Leave balances ({new Date().getFullYear()})</CardTitle>
        </CardHeader>
        <CardContent>
          {leaves.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No leave balances allocated yet. Ask HR to set them up.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {leaves.map((l: any) => {
                const allocated = Number(l.allocated);
                const used = Number(l.used);
                const pct = allocated ? Math.min((used / allocated) * 100, 100) : 0;
                return (
                  <li key={l.leave_type?.code} className="rounded-lg border bg-card p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="inline-flex items-center gap-2 font-medium">
                        <span className="h-2 w-2 rounded-full" style={{ background: l.leave_type?.color }} />
                        {l.leave_type?.name}
                      </span>
                      <span className="text-xs text-muted-foreground">{used} / {allocated}</span>
                    </div>
                    <Progress value={pct} className="mt-2 h-1.5" />
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <Card>
      <CardHeader className="pb-1"><CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">{icon}{label}</CardTitle></CardHeader>
      <CardContent className="pt-0">
        <p className="font-display text-2xl font-bold">{value}</p>
        {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function QuickAction({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center justify-center gap-1.5 rounded-lg border bg-card p-4 text-center transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm"
    >
      <Icon className="h-5 w-5 text-primary" />
      <span className="text-xs font-medium">{label}</span>
    </Link>
  );
}
