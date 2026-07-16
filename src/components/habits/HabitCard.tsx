import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { Flame, Check, MoreVertical, Edit3, Trash2, Bell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import {
  currentStreak,
  completionRate,
  isDueOn,
  todayKey,
  type Habit,
  type HabitLog,
  useDeleteHabit,
} from "@/lib/habits";
import { CheckInDialog } from "./CheckInDialog";
import { HabitDialog } from "./HabitDialog";

export function HabitCard({ habit, logs }: { habit: Habit; logs: HabitLog[] }) {
  const [checkIn, setCheckIn] = useState(false);
  const [edit, setEdit] = useState(false);
  const del = useDeleteHabit();

  const doneToday = useMemo(
    () => logs.some((l) => l.habit_id === habit.id && l.log_date === todayKey() && l.done),
    [logs, habit.id]
  );
  const streak = useMemo(() => currentStreak(habit, logs), [habit, logs]);
  const rate = useMemo(() => completionRate(habit, logs, 30), [habit, logs]);
  const dueToday = isDueOn(habit, new Date());

  const last7 = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(new Date(), -6 + i);
      const key = format(d, "yyyy-MM-dd");
      const due = isDueOn(habit, d);
      const done = logs.some((l) => l.habit_id === habit.id && l.log_date === key && l.done);
      return { key, due, done, day: format(d, "EEE")[0] };
    });
  }, [habit, logs]);

  return (
    <>
      <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className={cn(
          "group relative overflow-hidden border-border/60 bg-gradient-to-br from-card via-card to-primary/5 transition-all hover:border-primary/40 hover:shadow-lg",
          doneToday && "border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-card to-card"
        )}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <Link
                to="/me/habits/$habitId"
                params={{ habitId: habit.id }}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <div className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary-glow/20 text-2xl shadow-inner ring-1 ring-border/60",
                  doneToday && "from-emerald-500/30 to-emerald-500/10 ring-emerald-500/30"
                )}>
                  {habit.icon || "✨"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate font-semibold">{habit.title}</p>
                    {habit.reminder_times && habit.reminder_times.length > 0 && (
                      <Bell className="h-3 w-3 shrink-0 text-muted-foreground" />
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    {habit.category && <span className="truncate">{habit.category}</span>}
                    <span className="capitalize">• {habit.frequency}</span>
                  </div>
                </div>
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEdit(true)}>
                    <Edit3 className="mr-2 h-3.5 w-3.5" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => {
                      if (confirm(`Delete "${habit.title}"? All logs will be lost.`)) del.mutate(habit.id);
                    }}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Stats row */}
            <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-lg bg-muted/40 p-2 text-center">
              <div>
                <div className="flex items-center justify-center gap-0.5 text-sm font-bold text-amber-500">
                  <Flame className="h-3.5 w-3.5" />{streak}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Streak</div>
              </div>
              <div>
                <div className="text-sm font-bold text-primary">{rate}%</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">30d rate</div>
              </div>
              <div>
                <div className="text-sm font-bold">{logs.filter((l) => l.habit_id === habit.id && l.done).length}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</div>
              </div>
            </div>

            {/* Last 7 days */}
            <div className="mt-2.5 flex justify-between">
              {last7.map((d) => (
                <div key={d.key} className="flex flex-col items-center gap-0.5">
                  <div className={cn(
                    "h-6 w-6 rounded-md border transition-all",
                    !d.due && "border-dashed border-border/40 bg-transparent",
                    d.due && !d.done && "border-border/60 bg-muted/30",
                    d.due && d.done && "border-emerald-500/40 bg-gradient-to-br from-emerald-500/40 to-emerald-500/20"
                  )} />
                  <span className="text-[9px] text-muted-foreground">{d.day}</span>
                </div>
              ))}
            </div>

            {/* Action */}
            <Button
              onClick={() => setCheckIn(true)}
              disabled={!dueToday}
              size="sm"
              className={cn(
                "mt-3 w-full gap-1.5 transition-all",
                doneToday
                  ? "bg-emerald-500/20 text-emerald-700 hover:bg-emerald-500/30 dark:text-emerald-300"
                  : "bg-gradient-to-br from-primary to-primary-glow"
              )}
            >
              <Check className="h-3.5 w-3.5" />
              {doneToday ? "Completed today" : dueToday ? "Check in" : "Not scheduled today"}
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      <CheckInDialog open={checkIn} onOpenChange={setCheckIn} habit={habit} />
      <HabitDialog open={edit} onOpenChange={setEdit} habit={habit} />
    </>
  );
}
