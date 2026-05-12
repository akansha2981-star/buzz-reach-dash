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

  return (
    <>
      <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
        <Card
          className={cn(
            "group relative overflow-hidden border-border/60 bg-card/80 p-0 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg",
            done && "opacity-70"
          )}
        >
          {/* priority accent bar */}
          <span className={cn("absolute inset-y-0 left-0 w-1", PRIORITY_BAR[task.priority])} />

          <div className="flex items-start gap-2 p-3 pl-4 sm:gap-3 sm:p-4 sm:pl-5">
            {/* Complete button */}
            <button
              onClick={(e) => { e.stopPropagation(); toggle.mutate(task); }}
              aria-label={done ? "Mark incomplete" : "Mark complete"}
              className={cn(
                "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all sm:h-7 sm:w-7",
                done
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-muted-foreground/40 bg-background hover:border-primary hover:bg-primary/10"
              )}
            >
              <Check className={cn("h-3 w-3 transition-opacity sm:h-4 sm:w-4", done ? "opacity-100" : "opacity-0 group-hover:opacity-50")} />
            </button>

            {/* Body — clickable to edit */}
            <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setEdit(true)}>
              <p className={cn("text-sm font-semibold leading-snug sm:text-[15px]", done && "text-muted-foreground line-through")}>
                {task.title}
              </p>
              {task.description && (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className={cn("h-5 border px-1.5 text-[10px] font-medium uppercase tracking-wide", PRIORITY_TONES[task.priority])}>
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
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                    <Repeat className="h-3 w-3" /> {task.recurrence_rule.freq}
                  </span>
                )}
                {task.estimated_minutes && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    <Timer className="h-3 w-3" /> {task.estimated_minutes}m
                  </span>
                )}
                {task.category && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    <Tag className="h-3 w-3" /> {task.category}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-1">
              {/* Desktop: visible on hover */}
              <div className="hidden gap-1 sm:flex">
                <Button
                  size="sm"
                  variant={done ? "secondary" : "default"}
                  className="h-7 gap-1 px-2 text-xs opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); toggle.mutate(task); }}
                >
                  <Check className="h-3 w-3" /> {done ? "Undo" : "Complete"}
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); setEdit(true); }}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600 opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); setConfirmDel(true); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Mobile: dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-8 w-8 sm:hidden" onClick={(e) => e.stopPropagation()}>
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
