import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isPast, isToday } from "date-fns";
import { Plus, Filter, AlertTriangle, Clock, CheckCircle2, Circle, PlayCircle, Eye, X, Pencil, User as UserIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
import { useMyEmployee, isManagerRole, isHRAdminRole } from "@/lib/hr";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/hrms/tasks")({
  component: () => <HRShell title="HR Tasks"><HRTasksPage /></HRShell>,
});

const STATUSES = [
  { value: "todo", label: "To Do", icon: Circle, color: "text-muted-foreground" },
  { value: "in_progress", label: "In Progress", icon: PlayCircle, color: "text-blue-500" },
  { value: "review", label: "Review", icon: Eye, color: "text-purple-500" },
  { value: "done", label: "Done", icon: CheckCircle2, color: "text-emerald-500" },
  { value: "cancelled", label: "Cancelled", icon: X, color: "text-rose-500" },
];

const PRIORITIES = [
  { value: "low", label: "Low", tone: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/40" },
  { value: "medium", label: "Medium", tone: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40" },
  { value: "high", label: "High", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40" },
  { value: "urgent", label: "Urgent", tone: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40" },
];

function HRTasksPage() {
  const { data: me } = useMyEmployee();
  const canAssign = isManagerRole(me?.hr_role);
  const qc = useQueryClient();
  const [view, setView] = useState<"mine" | "assigned" | "all">("mine");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { data: tasks = [] } = useQuery({
    queryKey: ["hr-tasks", me?.id, view],
    enabled: !!me,
    queryFn: async () => {
      let q = supabase.from("hr_tasks").select("*").order("due_date", { ascending: true, nullsFirst: false });
      if (view === "mine") q = q.eq("assigned_to", me!.id);
      else if (view === "assigned") q = q.eq("assigned_by", me!.id);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["hr-emp-pick"],
    queryFn: async () => {
      const { data } = await supabase.from("hr_employees").select("id, full_name, designation").eq("status", "active").order("full_name");
      return data ?? [];
    },
  });
  const empMap = useMemo(() => Object.fromEntries(employees.map((e: any) => [e.id, e])), [employees]);

  const filtered = useMemo(() => tasks.filter((t: any) => {
    if (statusFilter === "active" && (t.status === "done" || t.status === "cancelled")) return false;
    if (statusFilter !== "all" && statusFilter !== "active" && t.status !== statusFilter) return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    return true;
  }), [tasks, statusFilter, priorityFilter]);

  const stats = useMemo(() => {
    const mine = tasks.filter((t: any) => t.assigned_to === me?.id);
    return {
      total: mine.length,
      open: mine.filter((t: any) => t.status !== "done" && t.status !== "cancelled").length,
      overdue: mine.filter((t: any) => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)) && t.status !== "done" && t.status !== "cancelled").length,
      done: mine.filter((t: any) => t.status === "done").length,
    };
  }, [tasks, me]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const patch: any = { status };
      if (status === "done") patch.completed_at = new Date().toISOString();
      const { error } = await supabase.from("hr_tasks").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-tasks"] }),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Circle} label="My Tasks" value={stats.total} tone="text-foreground" />
        <StatCard icon={PlayCircle} label="Open" value={stats.open} tone="text-blue-500" />
        <StatCard icon={AlertTriangle} label="Overdue" value={stats.overdue} tone="text-rose-500" />
        <StatCard icon={CheckCircle2} label="Done" value={stats.done} tone="text-emerald-500" />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <Select value={view} onValueChange={(v) => setView(v as any)}>
            <SelectTrigger className="w-full lg:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mine">Assigned to Me</SelectItem>
              {canAssign && <SelectItem value="assigned">I Assigned</SelectItem>}
              {isHRAdminRole(me?.hr_role) && <SelectItem value="all">All Tasks</SelectItem>}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full lg:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="all">All Status</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-full lg:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {canAssign && (
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
              <DialogTrigger asChild>
                <Button className="lg:ml-auto" onClick={() => setEditing(null)}><Plus className="h-4 w-4" /> New Task</Button>
              </DialogTrigger>
              <TaskFormDialog editing={editing} employees={employees} onClose={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["hr-tasks"] }); }} />
            </Dialog>
          )}
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-16 text-center text-sm text-muted-foreground">No tasks match these filters.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t: any) => {
            const status = STATUSES.find((s) => s.value === t.status)!;
            const priority = PRIORITIES.find((p) => p.value === t.priority)!;
            const StatusIcon = status.icon;
            const overdue = t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)) && t.status !== "done" && t.status !== "cancelled";
            const assignee = empMap[t.assigned_to];
            return (
              <Card key={t.id} className={cn("group transition-all", overdue && "border-rose-500/40")}>
                <CardContent className="flex items-start gap-3 p-3">
                  <button onClick={() => updateStatus.mutate({ id: t.id, status: t.status === "done" ? "todo" : "done" })} className="mt-0.5 shrink-0">
                    <StatusIcon className={cn("h-5 w-5", status.color)} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={cn("font-medium", t.status === "done" && "line-through text-muted-foreground")}>{t.title}</span>
                      <Badge variant="outline" className={cn("text-[10px]", priority.tone)}>{priority.label}</Badge>
                      {t.due_date && (
                        <Badge variant="outline" className={cn("text-[10px]", overdue && "border-rose-500/40 text-rose-600")}>
                          <Clock className="mr-1 h-2.5 w-2.5" />{format(new Date(t.due_date), "MMM dd")}
                        </Badge>
                      )}
                    </div>
                    {t.description && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{t.description}</p>}
                    <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><UserIcon className="h-2.5 w-2.5" />{assignee?.full_name ?? "—"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Select value={t.status} onValueChange={(v) => updateStatus.mutate({ id: t.id, status: v })}>
                      <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                    {(canAssign || t.assigned_by === me?.id) && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(t); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                    )}
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

function StatCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: string }) {
  return <Card><CardContent className="flex items-center gap-3 p-4">
    <Icon className={cn("h-5 w-5", tone)} />
    <div><div className="text-xs text-muted-foreground">{label}</div><div className={cn("font-display text-xl font-bold", tone)}>{value}</div></div>
  </CardContent></Card>;
}

function TaskFormDialog({ editing, employees, onClose }: { editing: any | null; employees: any[]; onClose: () => void }) {
  const { data: me } = useMyEmployee();
  const [form, setForm] = useState({
    title: editing?.title ?? "",
    description: editing?.description ?? "",
    assigned_to: editing?.assigned_to ?? me?.id ?? "",
    priority: editing?.priority ?? "medium",
    status: editing?.status ?? "todo",
    due_date: editing?.due_date ?? "",
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, due_date: form.due_date || null, assigned_by: editing?.assigned_by ?? me?.id };
      if (editing) {
        const { error } = await supabase.from("hr_tasks").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("hr_tasks").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(editing ? "Task updated" : "Task created"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader><DialogTitle>{editing ? "Edit Task" : "New Task"}</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1"><Label className="text-xs">Title *</Label><Input maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div className="col-span-2 space-y-1"><Label className="text-xs">Description</Label><Textarea rows={3} maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="space-y-1"><Label className="text-xs">Assignee *</Label>
          <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label className="text-xs">Priority</Label>
          <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label className="text-xs">Due Date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
        <div className="space-y-1"><Label className="text-xs">Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => save.mutate()} disabled={!form.title.trim() || !form.assigned_to || save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
