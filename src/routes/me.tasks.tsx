import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, LayoutGrid, List as ListIcon, Plus, CheckCircle2, Clock, AlertCircle, Flame } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MeShell } from "@/components/me/MeShell";
import { TaskCard } from "@/components/me/TaskCard";
import { useMyTasks, useCreateTask, deriveStatus, useUpdateTask, type MeTask, type MeTaskStatus, type MeTaskPriority } from "@/lib/me";
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/me/tasks")({
  component: TasksPage,
});

const KANBAN_COLS: { key: MeTaskStatus; label: string; tone: string }[] = [
  { key: "pending", label: "Pending", tone: "border-slate-500/30" },
  { key: "in_progress", label: "In Progress", tone: "border-blue-500/30" },
  { key: "completed", label: "Completed", tone: "border-emerald-500/30" },
  { key: "overdue", label: "Overdue", tone: "border-rose-500/30" },
];

function TasksPage() {
  const { data: tasks = [] } = useMyTasks();
  const [view, setView] = useState<"list" | "kanban">("list");
  const [q, setQ] = useState("");
  const [pri, setPri] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [sort, setSort] = useState<string>("due");

  const filtered = useMemo(() => {
    const r = tasks.filter((t) => {
      if (q && !(`${t.title} ${t.description ?? ""} ${(t.tags ?? []).join(" ")} ${t.category ?? ""}`).toLowerCase().includes(q.toLowerCase())) return false;
      if (pri !== "all" && t.priority !== pri) return false;
      if (status !== "all" && deriveStatus(t) !== status) return false;
      return true;
    });
    const PRI_ORDER: Record<MeTaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    r.sort((a, b) => {
      if (sort === "priority") return PRI_ORDER[a.priority] - PRI_ORDER[b.priority];
      if (sort === "title") return a.title.localeCompare(b.title);
      // due
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    });
    return r;
  }, [tasks, q, pri, status, sort]);

  return (
    <MeShell title="All Tasks" subtitle={`${filtered.length} of ${tasks.length} tasks`}>
      <Card>
        <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks, tags, categories…" className="pl-8" />
          </div>
          <Select value={pri} onValueChange={setPri}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priority</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="due">Due date</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="title">Title</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex rounded-lg border p-0.5">
            <Button size="sm" variant={view === "list" ? "default" : "ghost"} className="h-7 px-2" onClick={() => setView("list")}>
              <ListIcon className="h-4 w-4" />
            </Button>
            <Button size="sm" variant={view === "kanban" ? "default" : "ghost"} className="h-7 px-2" onClick={() => setView("kanban")}>
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {view === "list" ? (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.length === 0 ? (
              <p className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">No tasks match these filters.</p>
            ) : (
              filtered.map((t) => <TaskCard key={t.id} task={t} />)
            )}
          </AnimatePresence>
        </div>
      ) : (
        <KanbanView tasks={filtered} />
      )}
    </MeShell>
  );
}

function KanbanView({ tasks }: { tasks: MeTask[] }) {
  const update = useUpdateTask();
  const grouped = useMemo(() => {
    const m: Record<MeTaskStatus, MeTask[]> = { pending: [], in_progress: [], completed: [], overdue: [], delayed: [] };
    tasks.forEach((t) => {
      const s = deriveStatus(t);
      (m[s] ?? m.pending).push(t);
    });
    return m;
  }, [tasks]);

  const onDragEnd = (e: DragEndEvent) => {
    const id = e.active.id as string;
    const target = e.over?.id as MeTaskStatus | undefined;
    if (!target) return;
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    const patch: any = { status: target };
    if (target === "completed") patch.completed_at = new Date().toISOString();
    if (target !== "completed" && t.status === "completed") patch.completed_at = null;
    update.mutate({ id, ...patch });
  };

  return (
    <DndContext onDragEnd={onDragEnd}>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {KANBAN_COLS.map((col) => (
          <KanbanColumn key={col.key} col={col} tasks={grouped[col.key] ?? []} />
        ))}
      </div>
    </DndContext>
  );
}

function KanbanColumn({ col, tasks }: { col: { key: MeTaskStatus; label: string; tone: string }; tasks: MeTask[] }) {
  const { isOver, setNodeRef } = useDroppable({ id: col.key });
  return (
    <div ref={setNodeRef} className={cn("rounded-2xl border bg-muted/30 p-2 transition-colors", col.tone, isOver && "bg-primary/10 border-primary/40")}>
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wider">{col.label}</span>
        <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-medium">{tasks.length}</span>
      </div>
      <div className="space-y-2">
        {tasks.map((t) => <DraggableCard key={t.id} task={t} />)}
        {tasks.length === 0 && <p className="py-6 text-center text-[11px] text-muted-foreground">Drop tasks here</p>}
      </div>
    </div>
  );
}

function DraggableCard({ task }: { task: MeTask }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={cn(isDragging && "opacity-60")}>
      <TaskCard task={task} />
    </div>
  );
}
