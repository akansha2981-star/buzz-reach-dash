import { useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Clock, Repeat } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToggleComplete, deriveStatus, PRIORITY_TONES, STATUS_TONES, type MeTask } from "@/lib/me";
import { TaskDialog } from "./TaskDialog";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

export function TaskCard({ task }: { task: MeTask }) {
  const [edit, setEdit] = useState(false);
  const toggle = useToggleComplete();
  const status = deriveStatus(task);
  const done = status === "completed";

  return (
    <>
      <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
        <Card
          onClick={() => setEdit(true)}
          className={cn(
            "group cursor-pointer space-y-2 p-3 transition-all hover:-translate-y-0.5 hover:shadow-md",
            done && "opacity-60"
          )}
        >
          <div className="flex items-start gap-2">
            <Checkbox
              checked={done}
              onCheckedChange={() => toggle.mutate(task)}
              onClick={(e) => e.stopPropagation()}
              className="mt-0.5"
            />
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-medium leading-snug", done && "line-through")}>{task.title}</p>
              {task.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                <Badge variant="outline" className={cn("border", PRIORITY_TONES[task.priority])}>{task.priority}</Badge>
                <Badge variant="outline" className={cn("border", STATUS_TONES[status])}>{status.replace("_", " ")}</Badge>
                {task.due_date && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-3 w-3" /> {format(parseISO(task.due_date), "MMM d")}
                  </span>
                )}
                {task.due_time && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" /> {task.due_time.slice(0, 5)}
                  </span>
                )}
                {task.recurrence_rule && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Repeat className="h-3 w-3" /> {task.recurrence_rule.freq}
                  </span>
                )}
                {task.category && <Badge variant="secondary" className="text-[10px]">{task.category}</Badge>}
              </div>
            </div>
          </div>
        </Card>
      </motion.div>
      <TaskDialog open={edit} onOpenChange={setEdit} task={task} />
    </>
  );
}
