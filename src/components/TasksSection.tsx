import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, Plus, Trash2, Clock, AlertTriangle } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchTasks, spawnNextOccurrence, type Task } from "@/lib/tasks";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/useRealtime";
import { PushToCEODesk } from "@/components/PushToCEODesk";

export function TasksSection({ instituteId, instituteName }: { instituteId: string; instituteName: string }) {
  useRealtime("tasks", [["tasks", instituteId], ["tasks-all"]]);
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: tasks = [] } = useQuery({ queryKey: ["tasks", instituteId], queryFn: () => fetchTasks({ instituteId }) });

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [due, setDue] = useState("");
  const [open, setOpen] = useState(false);

  const create = useMutation({
    mutationFn: async () => {
      if (!title.trim()) return;
      const { error } = await supabase.from("tasks").insert({
        institute_id: instituteId,
        title: title.trim(),
        description: desc.trim() || null,
        due_at: due ? new Date(due).toISOString() : null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Task added");
      setTitle(""); setDesc(""); setDue(""); setOpen(false);
      qc.invalidateQueries({ queryKey: ["tasks", instituteId] });
      qc.invalidateQueries({ queryKey: ["tasks-all"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (t: Task) => {
      const newStatus = t.status === "done" ? "pending" : "done";
      const { error } = await supabase.from("tasks").update({
        status: newStatus,
        completed_at: newStatus === "done" ? new Date().toISOString() : null,
        completed_by: newStatus === "done" ? user?.id ?? null : null,
      }).eq("id", t.id);
      if (error) throw error;
      if (newStatus === "done") await spawnNextOccurrence(t);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", instituteId] });
      qc.invalidateQueries({ queryKey: ["tasks-all"] });
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", instituteId] }),
  });

  const pending = tasks.filter((t) => t.status === "pending");
  const done = tasks.filter((t) => t.status === "done");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Tasks <span className="ml-2 text-xs font-normal text-muted-foreground">{pending.length} pending</span></CardTitle>
        <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>
          <Plus className="mr-1 h-4 w-4" /> Add task
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {open && (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <Input placeholder={`Task for ${instituteName}…`} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            <Textarea rows={2} placeholder="Notes (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className="flex-1" />
              <Button size="sm" disabled={!title.trim() || create.isPending} onClick={() => create.mutate()}>Save</Button>
            </div>
          </div>
        )}

        {tasks.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No tasks yet.</p>}

        {pending.length > 0 && (
          <ul className="space-y-2">
            {pending.map((t) => <TaskRow key={t.id} task={t} onToggle={() => toggle.mutate(t)} onDelete={() => del.mutate(t.id)} />)}
          </ul>
        )}

        {done.length > 0 && (
          <details className="rounded-lg border bg-muted/20 px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">{done.length} completed</summary>
            <ul className="mt-2 space-y-2">
              {done.map((t) => <TaskRow key={t.id} task={t} onToggle={() => toggle.mutate(t)} onDelete={() => del.mutate(t.id)} />)}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

export function TaskRow({ task, onToggle, onDelete, extra }: { task: Task; onToggle: () => void; onDelete: () => void; extra?: React.ReactNode }) {
  const overdue = task.status === "pending" && task.due_at && isPast(new Date(task.due_at)) && !isToday(new Date(task.due_at));
  const today = task.status === "pending" && task.due_at && isToday(new Date(task.due_at));
  return (
    <li className={`group flex items-start gap-2 rounded-md border bg-card p-2 ${overdue ? "border-destructive/40 bg-destructive/5" : ""}`}>
      <button onClick={onToggle} className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary">
        {task.status === "done" ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Circle className="h-5 w-5" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${task.status === "done" ? "text-muted-foreground line-through" : ""}`}>{task.title}</p>
        {task.description && <p className="mt-0.5 text-xs text-muted-foreground">{task.description}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          {task.due_at && (
            <span className={`flex items-center gap-1 ${overdue ? "text-destructive" : today ? "text-amber-600" : "text-muted-foreground"}`}>
              {overdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              {format(new Date(task.due_at), "MMM d, h:mm a")}
              {overdue && <Badge variant="destructive" className="ml-1 h-4 px-1 text-[10px]">Overdue</Badge>}
              {today && !overdue && <Badge className="ml-1 h-4 bg-amber-500 px-1 text-[10px] hover:bg-amber-500">Today</Badge>}
            </span>
          )}
          {extra}
        </div>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
        {task.status !== "done" && (
          <PushToCEODesk sourceType="task" sourceId={task.id} instituteId={task.institute_id ?? null} title={task.title} />
        )}
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </li>
  );
}
