import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MeShell } from "@/components/me/MeShell";
import { TaskDialog } from "@/components/me/TaskDialog";
import { useMyTasks, useUpdateTask, deriveStatus, type MeTask } from "@/lib/me";
import { DndContext, useDraggable, useDroppable, type DragEndEvent } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/me/calendar")({
  component: CalendarPage,
});

function CalendarPage() {
  const [cursor, setCursor] = useState(new Date());
  const { data: tasks = [] } = useMyTasks();
  const update = useUpdateTask();
  const [openDate, setOpenDate] = useState<string | null>(null);

  const days = useMemo(() => eachDayOfInterval({
    start: startOfWeek(startOfMonth(cursor)),
    end: endOfWeek(endOfMonth(cursor)),
  }), [cursor]);

  const map = useMemo(() => {
    const m = new Map<string, MeTask[]>();
    tasks.forEach((t) => {
      if (!t.due_date) return;
      const arr = m.get(t.due_date) ?? [];
      arr.push(t);
      m.set(t.due_date, arr);
    });
    return m;
  }, [tasks]);

  const onDragEnd = (e: DragEndEvent) => {
    const id = e.active.id as string;
    const date = e.over?.id as string | undefined;
    if (!date) return;
    update.mutate({ id, due_date: date });
  };

  return (
    <MeShell title="Calendar" subtitle={format(cursor, "MMMM yyyy")}>
      <Card>
        <CardContent className="space-y-3 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setCursor(subMonths(cursor, 1))}><ChevronLeft className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" onClick={() => setCursor(new Date())}>Today</Button>
              <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setCursor(addMonths(cursor, 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <p className="font-display text-lg font-semibold">{format(cursor, "MMMM yyyy")}</p>
            <span className="hidden text-xs text-muted-foreground sm:inline">Drag tasks between days</span>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase text-muted-foreground">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => <div key={d}>{d}</div>)}
          </div>

          <DndContext onDragEnd={onDragEnd}>
            <div className="grid grid-cols-7 gap-1">
              {days.map((d) => {
                const key = format(d, "yyyy-MM-dd");
                const list = map.get(key) ?? [];
                return <DayCell key={key} date={d} dateStr={key} tasks={list} inMonth={isSameMonth(d, cursor)} onAdd={() => setOpenDate(key)} />;
              })}
            </div>
          </DndContext>
        </CardContent>
      </Card>
      <TaskDialog open={!!openDate} onOpenChange={(v) => !v && setOpenDate(null)} defaultDate={openDate ?? undefined} />
    </MeShell>
  );
}

function DayCell({ date, dateStr, tasks, inMonth, onAdd }: { date: Date; dateStr: string; tasks: MeTask[]; inMonth: boolean; onAdd: () => void }) {
  const { isOver, setNodeRef } = useDroppable({ id: dateStr });
  const today = isSameDay(date, new Date());
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group relative min-h-[88px] rounded-lg border p-1.5 text-left transition-colors",
        inMonth ? "bg-card" : "bg-muted/30 text-muted-foreground",
        today && "ring-2 ring-primary",
        isOver && "bg-primary/10 border-primary/40"
      )}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className={cn("text-[11px] font-semibold", today && "text-primary")}>{format(date, "d")}</span>
        <button onClick={onAdd} className="rounded p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100">
          <Plus className="h-3 w-3" />
        </button>
      </div>
      <div className="space-y-1">
        {tasks.slice(0, 3).map((t) => <DraggableMini key={t.id} task={t} />)}
        {tasks.length > 3 && <p className="text-[9px] text-muted-foreground">+{tasks.length - 3} more</p>}
      </div>
    </div>
  );
}

function DraggableMini({ task }: { task: MeTask }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const status = deriveStatus(task);
  const tone =
    status === "completed" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    : status === "overdue" ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
    : task.priority === "urgent" ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
    : task.priority === "high" ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
    : "bg-primary/10 text-primary";
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn("cursor-grab truncate rounded px-1.5 py-0.5 text-[10px] font-medium", tone, isDragging && "opacity-60")}
      title={task.title}
    >
      {task.title}
    </div>
  );
}
