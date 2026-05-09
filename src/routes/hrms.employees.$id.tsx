import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, Mail, Phone, Building2, Calendar, Briefcase, MapPin, CreditCard, FileText, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { HRShell, HRRoleBadge } from "@/components/hr/HRShell";
import { useDepartments, type HREmployee } from "@/lib/hr";

export const Route = createFileRoute("/hrms/employees/$id")({
  component: () => <HRShell title="Employee Profile"><EmployeeDetail /></HRShell>,
});

function EmployeeDetail() {
  const { id } = Route.useParams();
  const { data: departments = [] } = useDepartments();

  const { data: emp, isLoading } = useQuery({
    queryKey: ["hr-employee", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("hr_employees").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as HREmployee | null;
    },
  });

  const { data: manager } = useQuery({
    queryKey: ["hr-manager-of", emp?.reporting_manager_id],
    enabled: !!emp?.reporting_manager_id,
    queryFn: async () => {
      const { data } = await supabase.from("hr_employees").select("id, full_name, designation").eq("id", emp!.reporting_manager_id!).maybeSingle();
      return data;
    },
  });

  const { data: leaveStats } = useQuery({
    queryKey: ["hr-emp-leave-stats", id],
    enabled: !!emp,
    queryFn: async () => {
      const { count: pending } = await supabase.from("hr_leave_requests").select("id", { count: "exact", head: true }).eq("employee_id", id).eq("status", "pending");
      const { count: approved } = await supabase.from("hr_leave_requests").select("id", { count: "exact", head: true }).eq("employee_id", id).eq("status", "approved");
      return { pending: pending ?? 0, approved: approved ?? 0 };
    },
  });

  if (isLoading) return <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!emp) return <div className="py-16 text-center text-sm text-muted-foreground">Employee not found.</div>;

  const dept = departments.find((d) => d.id === emp.department_id);

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild><Link to="/hrms/employees"><ArrowLeft className="h-4 w-4" /> Back to Directory</Link></Button>

      <Card>
        <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 font-display text-2xl font-bold uppercase text-primary">
            {emp.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
          </div>
          <div className="flex-1 space-y-2">
            <div>
              <h1 className="font-display text-2xl font-bold">{emp.full_name}</h1>
              <p className="text-sm text-muted-foreground">{emp.designation ?? "—"} {dept ? `· ${dept.name}` : ""}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <HRRoleBadge role={emp.hr_role} />
              <Badge variant="outline">{emp.employment_type}</Badge>
              <Badge variant={emp.status === "active" ? "default" : "secondary"}>{emp.status}</Badge>
              {emp.employee_code && <Badge variant="secondary">{emp.employee_code}</Badge>}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Contact</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row icon={Mail} label="Email" value={emp.email} />
            <Row icon={Phone} label="Phone" value={emp.phone} />
            <Row icon={MapPin} label="Address" value={emp.address} />
            <Row icon={User} label="Emergency" value={emp.emergency_contact_name ? `${emp.emergency_contact_name} · ${emp.emergency_contact_phone ?? ""}` : null} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Employment</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row icon={Briefcase} label="Designation" value={emp.designation} />
            <Row icon={Building2} label="Department" value={dept?.name ?? null} />
            <Row icon={User} label="Reporting Manager" value={manager?.full_name ?? null} />
            <Row icon={Calendar} label="Joined" value={emp.joining_date ? format(new Date(emp.joining_date), "PPP") : null} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Bank & IDs</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row icon={CreditCard} label="Bank" value={emp.bank_name} />
            <Row icon={CreditCard} label="Account" value={emp.bank_account_number} />
            <Row icon={CreditCard} label="IFSC" value={emp.bank_ifsc} />
            <Row icon={FileText} label="PAN" value={emp.pan_number} />
            <Row icon={FileText} label="Aadhaar" value={emp.aadhaar_number} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Leaves Snapshot</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border bg-amber-500/5 p-3">
              <div className="text-xs text-muted-foreground">Pending</div>
              <div className="font-display text-2xl font-bold">{leaveStats?.pending ?? 0}</div>
            </div>
            <div className="rounded-lg border bg-emerald-500/5 p-3">
              <div className="text-xs text-muted-foreground">Approved</div>
              <div className="font-display text-2xl font-bold">{leaveStats?.approved ?? 0}</div>
            </div>
            {emp.notes && <div className="col-span-2 rounded-lg border bg-muted/30 p-3 text-xs"><div className="mb-1 font-medium">Notes</div>{emp.notes}</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="break-words">{value || <span className="text-muted-foreground">—</span>}</div>
      </div>
    </div>
  );
}
