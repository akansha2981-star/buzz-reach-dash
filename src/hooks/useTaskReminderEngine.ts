import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMyTasks, type MeTask } from "@/lib/me";
import { differenceInMinutes, parseISO, startOfDay, isBefore, format } from "date-fns";

// Scans personal tasks and inserts in-app notifications for:
//  - reminder_at within ±2 minutes (kind=reminder)
//  - task became overdue today (kind=overdue)
//  - task due within next 60 minutes (kind=upcoming)
// Deduplicated via localStorage.
export function useTaskReminderEngine() {
  const { user } = useAuth();
  const { data: tasks = [] } = useMyTasks();
  const tasksRef = useRef<MeTask[]>([]);
  tasksRef.current = tasks;

  useEffect(() => {
    if (!user) return;
    const KEY = `me_notif_seen_${user.id}`;
    const load = (): Record<string, number> => {
      try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
    };
    const save = (m: Record<string, number>) => localStorage.setItem(KEY, JSON.stringify(m));

    const tick = async () => {
      const now = new Date();
      const seen = load();
      const toInsert: any[] = [];
      const mark = (k: string) => { seen[k] = Date.now(); };
      // GC entries older than 7 days
      Object.keys(seen).forEach((k) => { if (Date.now() - seen[k] > 7 * 86400000) delete seen[k]; });

      for (const t of tasksRef.current) {
        if (t.status === "completed") continue;

        // Reminder
        if (t.reminder_at) {
          const k = `r:${t.id}:${t.reminder_at}`;
          const diff = Math.abs(differenceInMinutes(parseISO(t.reminder_at), now));
          if (diff <= 2 && !seen[k]) {
            toInsert.push({ user_id: user.id, type: "reminder", title: `Reminder: ${t.title}`, body: t.description ?? null, task_id: t.id });
            mark(k);
          }
        }

        // Overdue
        if (t.due_date) {
          const due = startOfDay(parseISO(t.due_date));
          if (isBefore(due, startOfDay(now))) {
            const k = `o:${t.id}:${format(now, "yyyy-MM-dd")}`;
            if (!seen[k]) {
              toInsert.push({ user_id: user.id, type: "overdue", title: `Overdue: ${t.title}`, body: `Was due ${format(due, "MMM d")}`, task_id: t.id });
              mark(k);
            }
          }
        }

        // Upcoming: due today + due_time within next 60 min
        if (t.due_date && t.due_time) {
          const dt = parseISO(`${t.due_date}T${t.due_time}`);
          const mins = differenceInMinutes(dt, now);
          if (mins >= 0 && mins <= 60) {
            const k = `u:${t.id}:${t.due_date}:${t.due_time}`;
            if (!seen[k]) {
              toInsert.push({ user_id: user.id, type: "upcoming", title: `Upcoming: ${t.title}`, body: `Due in ${mins} min`, task_id: t.id });
              mark(k);
            }
          }
        }
      }

      if (toInsert.length) {
        await supabase.from("me_notifications").insert(toInsert);
      }
      save(seen);
    };

    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [user]);
}
