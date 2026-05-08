import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isPast, isToday, isFuture } from "date-fns";
import { ListChecks, AlertTriangle, Calendar as CalendarIcon, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TaskRow } from "@/components/TasksSection";
import { fetchTasksWithInstitutes } from "@/lib/tasks";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRealtime } from "@/hooks/useRealtime";
import { toast } from "sonner";

export const Route = createFileRoute("/tasks")({ component: TasksPage });

function TasksPage() {
  useRealtime("tasks", [["tasks-all"]]);
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks-all"], queryFn: fetchTasksWithInstitutes });
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const m = q.trim().toLowerCase();
    if (!m) return tasks;
    return tasks.filter((t) => [t.title, t.description, t.institute?.name].some((v) => v?.toLowerCase().includes(m)));
  }, [tasks, q]);

  const overdue = filtered.filter((t) => t.status === "pending" && t.due_at && isPast(new Date(t.due_at)) && !isToday(new Date(t.due_at)));
  const today = filtered.filter((t) => t.status === "pending" && t.due_at && isToday(new Date(t.due_at)));
  const upcoming = filtered.filter((t) => t.status === "pending" && (!t.due_at || (t.due_at && isFuture(new Date(t.due_at)) && !isToday(new Date(t.due_at)))));
  const done = filtered.filter((t) => t.status === "done");

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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold">Tasks</h2>
              <p className="text-sm text-muted-foreground">All to-dos across colleges and coaching</p>
            </div>
            <Input className="sm:w-72" placeholder="Search tasks…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <SummaryCard icon={<AlertTriangle className="h-4 w-4 text-destructive" />} label="Overdue" value={overdue.length} tone="destructive" />
            <SummaryCard icon={<CalendarIcon className="h-4 w-4 text-amber-600" />} label="Today" value={today.length} tone="amber" />
            <SummaryCard icon={<ListChecks className="h-4 w-4 text-primary" />} label="Upcoming" value={upcoming.length} />
            <SummaryCard icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} label="Done" value={done.length} />
          </div>

          <Card>
            <CardContent className="p-4">
              <Tabs defaultValue="today">
                <TabsList className="w-full justify-start overflow-x-auto">
                  <TabsTrigger value="overdue">Overdue {overdue.length > 0 && <Badge variant="destructive" className="ml-1 h-4 px-1.5 text-[10px]">{overdue.length}</Badge>}</TabsTrigger>
                  <TabsTrigger value="today">Today {today.length > 0 && <Badge className="ml-1 h-4 px-1.5 text-[10px]">{today.length}</Badge>}</TabsTrigger>
                  <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                  <TabsTrigger value="done">Completed</TabsTrigger>
                </TabsList>
                <TabsContent value="overdue" className="mt-4">{renderList(overdue, "Nothing overdue. Great job!")}</TabsContent>
                <TabsContent value="today" className="mt-4">{renderList(today, "No tasks due today.")}</TabsContent>
                <TabsContent value="upcoming" className="mt-4">{renderList(upcoming, "No upcoming tasks.")}</TabsContent>
                <TabsContent value="done" className="mt-4">{renderList(done, "No completed tasks yet.")}</TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    </RequireAuth>
  );
}

function SummaryCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone?: "destructive" | "amber" }) {
  return (
    <Card className={tone === "destructive" ? "border-destructive/30 bg-destructive/5" : tone === "amber" ? "border-amber-500/30 bg-amber-500/5" : ""}>
      <CardHeader className="pb-1"><CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">{icon}{label}</CardTitle></CardHeader>
      <CardContent className="pt-0"><p className="font-display text-2xl font-bold">{value}</p></CardContent>
    </Card>
  );
}
