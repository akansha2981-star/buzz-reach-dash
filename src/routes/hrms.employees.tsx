import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Mail, Phone, Building2, ShieldCheck, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { HRShell, HRRoleBadge } from "@/components/hr/HRShell";
import { useDepartments, useMyEmployee, isHRAdminRole, HR_ROLES, type HRRole, type HREmployee, type HREmploymentStatus } from "@/lib/hr";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/hrms/employees")({
  component: () => <HRShell title="Employee Directory"><EmployeesPage /></HRShell>,
});

function EmployeesPage() {
  const { data: me } = useMyEmployee();
  const { isAdmin: isAppAdmin } = useAuth();
  const isAdmin = isHRAdminRole(me?.hr_role) || isAppAdmin;
  const { data: departments = [] } = useDepartments();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<HREmployee | null>(null);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["hr-employees-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("hr_employees").select("*").order("full_name");
      if (error) throw error;
      return (data ?? []) as HREmployee[];
    },
  });

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (deptFilter !== "all" && e.department_id !== deptFilter) return false;
      if (roleFilter !== "all" && e.hr_role !== roleFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (![e.full_name, e.email, e.employee_code, e.designation].some((v) => v?.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [employees, search, deptFilter, roleFilter, statusFilter]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, code, designation…" className="pl-8" />
          </div>
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-full lg:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full lg:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {HR_ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full lg:w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          {isAdmin && (
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditing(null)}><Plus className="h-4 w-4" /> Add Employee</Button>
              </DialogTrigger>
              <EmployeeFormDialog
                editing={editing}
                onClose={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["hr-employees-all"] }); }}
              />
            </Dialog>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading employees…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card/50 py-16 text-center text-sm text-muted-foreground">No employees match these filters.</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((emp) => {
            const dept = departments.find((d) => d.id === emp.department_id);
            return (
              <Card key={emp.id} className="group transition-all hover:shadow-md">
                <CardContent className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 font-display text-sm font-semibold uppercase text-primary">
                        {emp.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                      </div>
                      <div>
                        <Link to="/hrms/employees/$id" params={{ id: emp.id }} className="font-semibold leading-tight hover:underline">
                          {emp.full_name}
                        </Link>
                        <div className="text-xs text-muted-foreground">{emp.designation ?? "—"}</div>
                      </div>
                    </div>
                    {isAdmin && (
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(emp); setOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <HRRoleBadge role={emp.hr_role} />
                    <StatusBadge status={emp.status} />
                    {emp.employee_code && <Badge variant="secondary" className="text-[10px]">{emp.employee_code}</Badge>}
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {emp.email && <div className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{emp.email}</div>}
                    {emp.phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{emp.phone}</div>}
                    {dept && <div className="flex items-center gap-1.5"><Building2 className="h-3 w-3" />{dept.name}</div>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: HREmploymentStatus }) {
  const map = {
    active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40",
    suspended: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40",
    inactive: "bg-muted text-muted-foreground border-muted",
  };
  return <Badge variant="outline" className={map[status]}>{status}</Badge>;
}

function EmployeeFormDialog({ editing, onClose }: { editing: HREmployee | null; onClose: () => void }) {
  const { data: departments = [] } = useDepartments();
  const { data: managers = [] } = useQuery({
    queryKey: ["hr-managers"],
    queryFn: async () => {
      const { data } = await supabase.from("hr_employees").select("id, full_name, designation").in("hr_role", ["manager", "team_leader", "hr_admin", "super_admin"]).order("full_name");
      return data ?? [];
    },
  });

  const [form, setForm] = useState({
    full_name: editing?.full_name ?? "",
    email: editing?.email ?? "",
    phone: editing?.phone ?? "",
    employee_code: editing?.employee_code ?? "",
    designation: editing?.designation ?? "",
    department_id: editing?.department_id ?? "",
    reporting_manager_id: editing?.reporting_manager_id ?? "",
    hr_role: editing?.hr_role ?? "employee" as HRRole,
    employment_type: editing?.employment_type ?? "employee",
    status: editing?.status ?? "active" as HREmploymentStatus,
    joining_date: editing?.joining_date ?? "",
    notes: editing?.notes ?? "",
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        department_id: form.department_id || null,
        reporting_manager_id: form.reporting_manager_id || null,
        joining_date: form.joining_date || null,
        email: form.email || null,
        phone: form.phone || null,
        employee_code: form.employee_code || null,
        designation: form.designation || null,
        notes: form.notes || null,
      };
      if (editing) {
        const { error } = await supabase.from("hr_employees").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("hr_employees").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(editing ? "Employee updated" : "Employee added"); onClose(); },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>{editing ? "Edit Employee" : "Add Employee"}</DialogTitle></DialogHeader>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Full Name *"><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
        <Field label="Employee Code"><Input value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} /></Field>
        <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <Field label="Designation"><Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></Field>
        <Field label="Joining Date"><Input type="date" value={form.joining_date} onChange={(e) => setForm({ ...form, joining_date: e.target.value })} /></Field>
        <Field label="Department">
          <Select value={form.department_id || "none"} onValueChange={(v) => setForm({ ...form, department_id: v === "none" ? "" : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— None —</SelectItem>
              {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Reporting Manager">
          <Select value={form.reporting_manager_id || "none"} onValueChange={(v) => setForm({ ...form, reporting_manager_id: v === "none" ? "" : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— None —</SelectItem>
              {managers.filter((m: any) => m.id !== editing?.id).map((m: any) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="HR Role">
          <Select value={form.hr_role} onValueChange={(v) => setForm({ ...form, hr_role: v as HRRole })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{HR_ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Employment Type">
          <Select value={form.employment_type} onValueChange={(v) => setForm({ ...form, employment_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="employee">Full-time</SelectItem>
              <SelectItem value="part_time">Part-time</SelectItem>
              <SelectItem value="intern">Intern</SelectItem>
              <SelectItem value="contract">Contract</SelectItem>
              <SelectItem value="trainer">Trainer</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Status">
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as HREmploymentStatus })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => save.mutate()} disabled={!form.full_name || save.isPending}>
          <ShieldCheck className="h-4 w-4" /> {save.isPending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}
