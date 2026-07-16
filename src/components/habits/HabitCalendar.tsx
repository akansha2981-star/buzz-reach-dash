import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isAfter,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { cn } from "@/lib/utils";
import { isDueOn, type Habit, type HabitLog } from "@/lib/habits";
import { CheckInDialog } from "./CheckInDialog";

interface Props {
  habit: Habit;
  logs: HabitLog[];
}

export function HabitCalendar({ habit, logs }: Props) {
  const [cursor, setCursor] = useState(new Date());
  const [checkIn, setCheckIn] = useState<{ open: boolean; date?: string }>({ open: false });

  const doneMap = useMemo(() => {
    const m = new Map<string, HabitLog>();
    for (const l of logs) if (l.habit_id === habit.id) m.set(l.log_date, l);
    return m;
  }, [logs, habit.id]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const monthStats = useMemo(() => {
    const inMonth = days.filter((d) => isSameMonth(d, cursor));
    let due = 0, done = 0;
    for (const d of inMonth) {
      if (isAfter(d, new Date())) continue;
      if (!isDueOn(habit, d)) continue;
      due++;
      const log = doneMap.get(format(d, "yyyy-MM-dd"));
      if (log?.done) done++;
    }
    return { due, done, rate: due ? Math.round((done / due) * 100) : 0 };
  }, [days, cursor, habit, doneMap]);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <CalIcon className="h-4 w-4" /> {format(cursor, "MMMM yyyy")}
          </p>
          <div className="flex items-center gap-1">
            <span className="mr-2 text-[11px] text-muted-foreground">
              {monthStats.done}/{monthStats.due} · {monthStats.rate}%
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCursor(addMonths(cursor, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setCursor(new Date())}>
              Today
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCursor(addMonths(cursor, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-muted-foreground">
          {["S","M","T","W","T","F","S"].map((d, i) => <div key={i}>{d}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const key = format(d, "yyyy-MM-dd");
            const log = doneMap.get(key);
            const inMonth = isSameMonth(d, cursor);
            const future = isAfter(d, new Date()) && !isToday(d);
            const due = isDueOn(habit, d);
            const done = !!log?.done;
            const partial = log && !log.done;
            const startBlocked = habit.start_date ? d < parseISO(habit.start_date) : false;

            return (
              <button
                key={key}
                disabled={future || startBlocked}
                onClick={() => setCheckIn({ open: true, date: key })}
                className={cn(
                  "relative aspect-square rounded-lg border text-xs font-medium transition-all",
                  !inMonth && "opacity-40",
                  future || startBlocked ? "cursor-not-allowed border-transparent bg-muted/20 text-muted-foreground/50" :
                    "hover:scale-[1.05] hover:shadow-sm",
                  done && "border-emerald-500/60 bg-gradient-to-br from-emerald-500/30 to-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                  !done && partial && "border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                  !done && !partial && due && !future && !startBlocked && "border-dashed border-border/70 bg-muted/30",
                  !due && !done && "border-transparent",
                  isToday(d) && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                )}
                title={done ? "Completed — tap to edit" : partial ? "Logged — tap to edit" : due ? "Tap to check in" : "Not scheduled"}
              >
                <span>{format(d, "d")}</span>
                {done && <span className="absolute bottom-0.5 right-0.5 text-[8px]">✓</span>}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
          <Legend cls="bg-gradient-to-br from-emerald-500/30 to-emerald-500/10 border border-emerald-500/60" label="Done" />
          <Legend cls="bg-amber-500/10 border border-amber-500/60" label="Logged" />
          <Legend cls="bg-muted/30 border border-dashed border-border/70" label="Due" />
          <span>Tap any day to edit.</span>
        </div>

        <CheckInDialog
          open={checkIn.open}
          onOpenChange={(o) => setCheckIn({ open: o })}
          habit={habit}
          logDate={checkIn.date}
        />
      </CardContent>
    </Card>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("h-3 w-3 rounded", cls)} />
      {label}
    </span>
  );
}
