import { useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Clock, Repeat, Pencil, Trash2, Check, MoreVertical, Tag, Timer } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToggleComplete, useDeleteTask, deriveStatus, PRIORITY_TONES, STATUS_TONES, type MeTask } from "@/lib/me";
import { useMyCategories, iconFor, toneStyle } from "@/lib/me-categories";
import { TaskDialog } from "./TaskDialog";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

const PRIORITY_BAR: Record<string, string> = {
  low: "bg-slate-400",
  medium: "bg-sky-500",
  high: "bg-amber-500",
  urgent: "bg-rose-500",
};

export function TaskCard({ task }: { task: MeTask }) {
  const [edit, setEdit] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const toggle = useToggleComplete();
  const del = useDeleteTask();
  const status = deriveStatus(task);
  const done = status === "completed";
  const { data: categories = [] } = useMyCategories();
  const catDef = task.category ? categories.find((c) => c.name === task.category) : null;
  const CatIcon = iconFor(catDef?.icon);

  return (
    <>
      <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
        <Card
          className={cn(
            "group relative overflow-hidden border-border/60 bg-gradient-to-br from-card to-card/60 p-0 shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg",
            done && "opacity-75"
          )}
        >
          {/* priority accent bar */}
          <span className={cn("absolute inset-y-0 left-0 w-1.5", PRIORITY_BAR[task.priority])} />

          <div className="flex flex-col gap-3 p-3 pl-4 sm:flex-row sm:items-start sm:gap-3 sm:p-4 sm:pl-5">
            {/* Top row: checkbox + title + mobile menu */}
            <div className="flex items-start gap-3 sm:contents">
              <button
                onClick={(e) => { e.stopPropagation(); toggle.mutate(task); }}
                aria-label={done ? "Mark incomplete" : "Mark complete"}
                className={cn(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                  done
                    ? "border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-500/30"
                    : "border-muted-foreground/40 bg-background hover:border-primary hover:bg-primary/10"
                )}
              >
                <Check className={cn("h-4 w-4 transition-opacity", done ? "opacity-100" : "opacity-30")} />
              </button>

              <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setEdit(true)}>
                <p className={cn("text-[15px] font-semibold leading-snug", done && "text-muted-foreground line-through")}>
                  {task.title}
                </p>
                {task.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className={cn("h-5 border px-1.5 text-[10px] font-semibold uppercase tracking-wide", PRIORITY_TONES[task.priority])}>
                    {task.priority}
                  </Badge>
                  <Badge variant="outline" className={cn("h-5 border px-1.5 text-[10px]", STATUS_TONES[status])}>
                    {status.replace("_", " ")}
                  </Badge>
                  {task.due_date && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      <Calendar className="h-3 w-3" /> {format(parseISO(task.due_date), "MMM d")}
                    </span>
                  )}
                  {task.due_time && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" /> {task.due_time.slice(0, 5)}
                    </span>
                  )}
                  {task.recurrence_rule && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      <Repeat className="h-3 w-3" /> {task.recurrence_rule.freq}
                    </span>
                  )}
                  {task.estimated_minutes && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      <Timer className="h-3 w-3" /> {task.estimated_minutes}m
                    </span>
                  )}
                  {task.category && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium"
                      style={toneStyle(catDef?.color)}
                    >
                      <CatIcon className="h-3 w-3" /> {task.category}
                    </span>
                  )}
                </div>
              </div>

              {/* Mobile overflow */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 sm:hidden" onClick={(e) => e.stopPropagation()}>
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => toggle.mutate(task)}>
                    <Check className="mr-2 h-4 w-4" /> {done ? "Mark incomplete" : "Mark complete"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setEdit(true)}>
                    <Pencil className="mr-2 h-4 w-4" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-rose-600 focus:text-rose-600" onClick={() => setConfirmDel(true)}>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Persistent action bar — mobile (full row) + desktop (right side) */}
            <div className="flex items-center gap-1.5 sm:ml-auto sm:shrink-0 sm:flex-col sm:items-end sm:gap-1.5 sm:pl-2">
              <Button
                size="sm"
                variant={done ? "outline" : "default"}
                className={cn(
                  "h-8 flex-1 gap-1 px-3 text-xs font-medium sm:flex-none",
                  !done && "bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
                )}
                onClick={(e) => { e.stopPropagation(); toggle.mutate(task); }}
              >
                <Check className="h-3.5 w-3.5" /> {done ? "Undo" : "Complete"}
              </Button>
              <div className="hidden gap-1 sm:flex">
                <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg" onClick={(e) => { e.stopPropagation(); setEdit(true); }} aria-label="Edit">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950" onClick={(e) => { e.stopPropagation(); setConfirmDel(true); }} aria-label="Delete">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      <TaskDialog open={edit} onOpenChange={setEdit} task={task} />

      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              "{task.title}" will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => del.mutate(task.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
