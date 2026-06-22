import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isPast, isToday, isFuture, isWithinInterval, addDays, format } from "date-fns";
import { ListChecks, AlertTriangle, Calendar as CalendarIcon, CheckCircle2, Filter, X, Search, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TaskRow } from "@/components/TasksSection";
import { NewTaskDialog } from "@/components/NewTaskDialog";
import { fetchTasksWithInstitutes } from "@/lib/tasks";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRealtime } from "@/hooks/useRealtime";
import { toast } from "sonner";

export const Route = createFileRoute("/tasks")({ component: TasksPage });


type DueKey = "all" | "overdue" | "today" | "week" | "month" | "nodate";
type TypeKey = "all" | "college" | "coaching";
type SortKey = "due_asc" | "due_desc" | "recent" | "title";

function TasksPage() {
  useRealtime("tasks", [["tasks-all"]]);
  const { user, isAdmin, perms } = useAuth();
  const can = (k: keyof typeof perms) => isAdmin || perms[k];
  const qc = useQueryClient();
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks-all"], queryFn: fetchTasksWithInstitutes });


  const [q, setQ] = useState("");
  const [due, setDue] = useState<DueKey>("all");
  const [typeFilter, setTypeFilter] = useState<TypeKey>("all");
  const [instFilter, setInstFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortKey>("due_asc");

  const institutes = useMemo(() => {
    const map = new Map<string, { id: string; name: string; type: string }>();
    tasks.forEach((t) => { if (t.institute) map.set(t.institute.id, t.institute); });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const filtered = useMemo(() => {
    const m = q.trim().toLowerCase();
    let out = tasks.filter((t) => {
      if (typeFilter !== "all" && t.institute?.type !== typeFilter) return false;
      if (instFilter !== "all" && t.institute?.id !== instFilter) return false;
      if (m && ![t.title, t.description, t.institute?.name].some((v) => v?.toLowerCase().includes(m))) return false;
      if (due === "overdue") return t.status === "pending" && t.due_at && isPast(new Date(t.due_at)) && !isToday(new Date(t.due_at));
      if (due === "today") return t.due_at && isToday(new Date(t.due_at));
      if (due === "week") return t.due_at && isWithinInterval(new Date(t.due_at), { start: new Date(), end: addDays(new Date(), 7) });
      if (due === "month") return t.due_at && isWithinInterval(new Date(t.due_at), { start: new Date(), end: addDays(new Date(), 30) });
      if (due === "nodate") return !t.due_at;
      return true;
    });
    out = [...out].sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "recent") return +new Date(b.created_at) - +new Date(a.created_at);
      const at = a.due_at ? +new Date(a.due_at) : Infinity;
      const bt = b.due_at ? +new Date(b.due_at) : Infinity;
      return sortBy === "due_desc" ? bt - at : at - bt;
    });
    return out;
  }, [tasks, q, due, typeFilter, instFilter, sortBy]);

  const overdue = filtered.filter((t) => t.status === "pending" && t.due_at && isPast(new Date(t.due_at)) && !isToday(new Date(t.due_at)));
  const today = filtered.filter((t) => t.status === "pending" && t.due_at && isToday(new Date(t.due_at)));
  const upcoming = filtered.filter((t) => t.status === "pending" && (!t.due_at || (t.due_at && isFuture(new Date(t.due_at)) && !isToday(new Date(t.due_at)))));
  const done = filtered.filter((t) => t.status === "done");

  const completionRate = filtered.length ? Math.round((done.length / filtered.length) * 100) : 0;
  const activeFilters = (due !== "all" ? 1 : 0) + (typeFilter !== "all" ? 1 : 0) + (instFilter !== "all" ? 1 : 0) + (q ? 1 : 0);

  const toggle = useMutation({
    mutationFn: async (t: any) => {
      const newStatus = t.status === "done" ? "pending" : "done";
      const { error } = await supabase.from("tasks").update({
        status: newStatus,
        completed_at: newStatus === "done" ? new Date().toISOString() : null,
        completed_by: newStatus === "done" ? user?.id ?? null : null,
      }).eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks-all"] }),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Task deleted"); qc.invalidateQueries({ queryKey: ["tasks-all"] }); },
  });

  const clear = () => { setQ(""); setDue("all"); setTypeFilter("all"); setInstFilter("all"); };

  const renderList = (list: typeof filtered, empty: string) => (
    list.length === 0
      ? <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>
      : <ul className="space-y-2">{list.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            onToggle={() => toggle.mutate(t)}
            onDelete={() => del.mutate(t.id)}
            extra={t.institute && (
              <Link to="/outreach/$type/$id" params={{ type: t.institute.type === "college" ? "colleges" : "coaching", id: t.institute.id }}
                className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium hover:bg-primary/10 hover:text-primary">
                {t.institute.name}
              </Link>
            )}
          />
        ))}</ul>
  );

  return (
    <RequireAuth>
      <AppShell title="Tasks">
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold">Tasks</h2>
              <p className="text-sm text-muted-foreground">All to-dos across colleges and coaching</p>
            </div>
            {can("can_tasks") && (
              <NewTaskDialog
                trigger={
                  <Button size="sm" className="gap-1.5 self-start sm:self-auto">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Add task</span>
                    <span className="sm:hidden">Add</span>
                  </Button>
                }
              />
            )}
          </div>


          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryCard icon={<AlertTriangle className="h-4 w-4 text-destructive" />} label="Overdue" value={overdue.length} tone="destructive" />
            <SummaryCard icon={<CalendarIcon className="h-4 w-4 text-amber-600" />} label="Today" value={today.length} tone="amber" />
            <SummaryCard icon={<ListChecks className="h-4 w-4 text-primary" />} label="Upcoming" value={upcoming.length} />
            <SummaryCard icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} label="Done" value={done.length} />
            <SummaryCard icon={<CheckCircle2 className="h-4 w-4 text-primary" />} label="Completion" value={`${completionRate}%`} />
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Search by title, notes, or institute…" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                <Select value={sortBy} onValueChange={(v: SortKey) => setSortBy(v)}>
                  <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="due_asc">Due date (soonest)</SelectItem>
                    <SelectItem value="due_desc">Due date (latest)</SelectItem>
                    <SelectItem value="recent">Recently created</SelectItem>
                    <SelectItem value="title">Title (A–Z)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1 text-xs text-muted-foreground"><Filter className="h-3 w-3" /> Filters</span>
                <Select value={due} onValueChange={(v: DueKey) => setDue(v)}>
                  <SelectTrigger className="h-8 w-auto gap-1 px-3 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All due dates</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="today">Due today</SelectItem>
                    <SelectItem value="week">Due this week</SelectItem>
                    <SelectItem value="month">Due this month</SelectItem>
                    <SelectItem value="nodate">No due date</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={(v: TypeKey) => setTypeFilter(v)}>
                  <SelectTrigger className="h-8 w-auto gap-1 px-3 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="college">Colleges</SelectItem>
                    <SelectItem value="coaching">Coaching</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={instFilter} onValueChange={setInstFilter}>
                  <SelectTrigger className="h-8 w-auto gap-1 px-3 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All institutes</SelectItem>
                    {institutes.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {activeFilters > 0 && (
                  <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs" onClick={clear}><X className="h-3 w-3" /> Clear</Button>
                )}
                <span className="ml-auto text-xs text-muted-foreground">{filtered.length} of {tasks.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <Tabs defaultValue="today">
                <TabsList className="w-full justify-start overflow-x-auto">
                  <TabsTrigger value="overdue">Overdue {overdue.length > 0 && <Badge variant="destructive" className="ml-1 h-4 px-1.5 text-[10px]">{overdue.length}</Badge>}</TabsTrigger>
                  <TabsTrigger value="today">Today {today.length > 0 && <Badge className="ml-1 h-4 px-1.5 text-[10px]">{today.length}</Badge>}</TabsTrigger>
                  <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                  <TabsTrigger value="done">Completed</TabsTrigger>
                  <TabsTrigger value="all">All</TabsTrigger>
                </TabsList>
                <TabsContent value="overdue" className="mt-4">{renderList(overdue, "Nothing overdue. Great job!")}</TabsContent>
                <TabsContent value="today" className="mt-4">{renderList(today, "No tasks due today.")}</TabsContent>
                <TabsContent value="upcoming" className="mt-4">{renderList(upcoming, "No upcoming tasks.")}</TabsContent>
                <TabsContent value="done" className="mt-4">{renderList(done, "No completed tasks yet.")}</TabsContent>
                <TabsContent value="all" className="mt-4">{renderList(filtered, "No tasks match your filters.")}</TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    </RequireAuth>
  );
}

function SummaryCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number | string; tone?: "destructive" | "amber" }) {
  return (
    <Card className={tone === "destructive" ? "border-destructive/30 bg-destructive/5" : tone === "amber" ? "border-amber-500/30 bg-amber-500/5" : ""}>
      <CardHeader className="pb-1"><CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">{icon}{label}</CardTitle></CardHeader>
      <CardContent className="pt-0"><p className="font-display text-2xl font-bold">{value}</p></CardContent>
    </Card>
  );
}
