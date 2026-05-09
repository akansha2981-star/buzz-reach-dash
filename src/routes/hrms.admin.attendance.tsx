import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { Calendar, Filter, Users, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { HRShell } from "@/components/hr/HRShell";
import { useDepartments, fmtMinutes, type HRAttendanceStatus } from "@/lib/hr";

export const Route = createFileRoute("/hrms/admin/attendance")({
  component: () => <HRShell title="Org Attendance"><AdminAttendancePage /></HRShell>,
});

function AdminAttendancePage() {
  const { data: departments = [] } = useDepartments();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: employees = [] } = useQuery({
    queryKey: ["hr-employees-active"],
    queryFn: async () => {
      const { data } = await supabase.from("hr_employees").select("id, full_name, employee_code, department_id, designation").eq("status", "active").order("full_name");
      return data ?? [];
    },
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["hr-attendance-day", date],
    queryFn: async () => {
      const { data } = await supabase.from("hr_attendance").select("*").eq("work_date", date);
      return data ?? [];
    },
  });

  const filteredEmployees = useMemo(() => {
    return employees.filter((e: any) => {
      if (deptFilter !== "all" && e.department_id !== deptFilter) return false;
      if (statusFilter !== "all") {
        const att = attendance.find((a: any) => a.employee_id === e.id);
        const s = att?.status ?? "absent";
        if (statusFilter === "absent" ? s !== "absent" && !!att : s !== statusFilter) return false;
      }
      return true;
    });
  }, [employees, attendance, deptFilter, statusFilter]);

  const stats = useMemo(() => {
    const present = attendance.filter((a: any) => a.status === "present" || a.status === "wfh").length;
    const late = attendance.filter((a: any) => a.status === "late").length;
    const halfDay = attendance.filter((a: any) => a.status === "half_day").length;
    const absent = employees.length - attendance.length;
    return { present, late, halfDay, absent, total: employees.length };
  }, [attendance, employees]);

  const exportCsv = () => {
    const rows = [["Name", "Code", "Status", "Clock In", "Clock Out", "Work", "Break"]];
    filteredEmployees.forEach((e: any) => {
      const a: any = attendance.find((x: any) => x.employee_id === e.id);
      rows.push([
        e.full_name,
        e.employee_code ?? "",
        a?.status ?? "absent",
        a?.clock_in_at ? format(new Date(a.clock_in_at), "HH:mm") : "",
        a?.clock_out_at ? format(new Date(a.clock_out_at), "HH:mm") : "",
        a ? fmtMinutes(a.total_work_minutes) : "",
        a ? fmtMinutes(a.total_break_minutes) : "",
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `attendance-${date}.csv`; a.click();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Total" value={stats.total} icon={Users} tone="text-foreground" />
        <StatCard label="Present" value={stats.present} icon={Users} tone="text-emerald-600 dark:text-emerald-400" />
        <StatCard label="Late" value={stats.late} icon={Users} tone="text-amber-600 dark:text-amber-400" />
        <StatCard label="Half Day" value={stats.halfDay} icon={Users} tone="text-blue-600 dark:text-blue-400" />
        <StatCard label="Absent" value={stats.absent} icon={Users} tone="text-rose-600 dark:text-rose-400" />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <div className="flex items-center gap-2 text-sm font-medium"><Filter className="h-4 w-4" /> Filters</div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
          </div>
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-full lg:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full lg:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="present">Present</SelectItem>
              <SelectItem value="late">Late</SelectItem>
              <SelectItem value="half_day">Half Day</SelectItem>
              <SelectItem value="wfh">WFH</SelectItem>
              <SelectItem value="absent">Absent</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCsv} className="lg:ml-auto"><Download className="h-4 w-4" /> CSV</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Day Sheet — {format(new Date(date), "PPP")}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Employee</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Clock In</th>
                <th className="px-4 py-2 text-left">Clock Out</th>
                <th className="px-4 py-2 text-left">Work</th>
                <th className="px-4 py-2 text-left">Break</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((e: any) => {
                const a: any = attendance.find((x: any) => x.employee_id === e.id);
                const dept = departments.find((d) => d.id === e.department_id);
                return (
                  <tr key={e.id} className="border-t hover:bg-muted/20">
                    <td className="px-4 py-2">
                      <div className="font-medium">{e.full_name}</div>
                      <div className="text-xs text-muted-foreground">{[e.employee_code, dept?.name].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className="px-4 py-2"><AttBadge status={a?.status ?? "absent"} hasRow={!!a} /></td>
                    <td className="px-4 py-2 text-muted-foreground">{a?.clock_in_at ? format(new Date(a.clock_in_at), "HH:mm") : "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{a?.clock_out_at ? format(new Date(a.clock_out_at), "HH:mm") : "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{a ? fmtMinutes(a.total_work_minutes) : "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{a ? fmtMinutes(a.total_break_minutes) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredEmployees.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">No employees match these filters.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <Icon className={`h-5 w-5 ${tone}`} />
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className={`font-display text-xl font-bold ${tone}`}>{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function AttBadge({ status, hasRow }: { status: HRAttendanceStatus | "absent"; hasRow: boolean }) {
  if (!hasRow) return <Badge variant="outline" className="border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300">absent</Badge>;
  const map: Record<string, string> = {
    present: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    late: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    half_day: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    wfh: "border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-300",
    absent: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    holiday: "border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
    leave: "border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  };
  return <Badge variant="outline" className={map[status]}>{status.replace("_", " ")}</Badge>;
}
