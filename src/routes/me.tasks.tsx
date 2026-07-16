import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, LayoutGrid, List as ListIcon, Plus, CheckCircle2, Clock, AlertCircle, Flame, Tag as TagIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MeShell } from "@/components/me/MeShell";
import { TaskCard } from "@/components/me/TaskCard";
import { CategoryManager } from "@/components/me/CategoryManager";
import { useMyTasks, useCreateTask, deriveStatus, useUpdateTask, type MeTask, type MeTaskStatus, type MeTaskPriority } from "@/lib/me";
import { useMyCategories, iconFor } from "@/lib/me-categories";
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
  const { data: categories = [] } = useMyCategories();
  const [view, setView] = useState<"list" | "kanban">("list");
  const [q, setQ] = useState("");
  const [pri, setPri] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [cat, setCat] = useState<string>("all");
  const [sort, setSort] = useState<string>("due");

  const catOrder = useMemo(() => {
    const m = new Map<string, number>();
    categories.forEach((c, i) => m.set(c.name, i));
    return m;
  }, [categories]);

  const filtered = useMemo(() => {
    const r = tasks.filter((t) => {
      if (q && !(`${t.title} ${t.description ?? ""} ${(t.tags ?? []).join(" ")} ${t.category ?? ""}`).toLowerCase().includes(q.toLowerCase())) return false;
      if (pri !== "all" && t.priority !== pri) return false;
      if (status !== "all" && deriveStatus(t) !== status) return false;
      if (cat !== "all") {
        if (cat === "__none__") { if (t.category) return false; }
        else if (t.category !== cat) return false;
      }
      return true;
    });
    const PRI_ORDER: Record<MeTaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    r.sort((a, b) => {
      if (sort === "priority") return PRI_ORDER[a.priority] - PRI_ORDER[b.priority];
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "category") {
        const ao = a.category ? (catOrder.get(a.category) ?? 999) : 1000;
        const bo = b.category ? (catOrder.get(b.category) ?? 999) : 1000;
        if (ao !== bo) return ao - bo;
        return (a.category ?? "").localeCompare(b.category ?? "");
      }
      // due
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    });
    return r;
  }, [tasks, q, pri, status, cat, sort, catOrder]);

  const stats = useMemo(() => {
    const s = { total: tasks.length, completed: 0, pending: 0, overdue: 0, urgent: 0 };
    tasks.forEach((t) => {
      const st = deriveStatus(t);
      if (st === "completed") s.completed++; else s.pending++;
      if (st === "overdue") s.overdue++;
      if (t.priority === "urgent" && st !== "completed") s.urgent++;
    });
    return s;
  }, [tasks]);

  return (
    <MeShell title="All Tasks" subtitle={`${filtered.length} of ${tasks.length} tasks`}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile icon={CheckCircle2} label="Completed" value={stats.completed} tone="text-emerald-600" />
        <StatTile icon={Clock} label="Pending" value={stats.pending} tone="text-blue-600" />
        <StatTile icon={AlertCircle} label="Overdue" value={stats.overdue} tone="text-rose-600" />
        <StatTile icon={Flame} label="Urgent" value={stats.urgent} tone="text-amber-600" />
      </div>
      <QuickAddInline />
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

function StatTile({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: string }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-center gap-3 p-3">
        <div className={cn("rounded-xl bg-muted p-2", tone)}><Icon className="h-4 w-4" /></div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-xl font-bold leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickAddInline() {
  const [title, setTitle] = useState("");
  const create = useCreateTask();
  const submit = async () => {
    if (!title.trim()) return;
    await create.mutateAsync({ title: title.trim() });
    setTitle("");
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-2 p-2">
        <Plus className="ml-1 h-4 w-4 text-muted-foreground" />
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="Quick add a task and press Enter…"
          className="border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
        {title && <Button size="sm" onClick={submit} disabled={create.isPending}>Add</Button>}
      </CardContent>
    </Card>
  );
}
