import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { isDueOn, todayKey, type Habit } from "@/lib/habits";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

// Client-side reminder scheduler for habits due today.
// Fires a browser notification + toast at each reminder time and marks a
// pending state if the habit is not yet done.
export function useHabitReminders(habits: Habit[]) {
  const { user } = useAuth();
  const scheduled = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user || !habits?.length) return;
    if (typeof window === "undefined") return;

    if ("Notification" in window && Notification.permission === "default") {
      // request lazily on first render — no-op if denied
      Notification.requestPermission().catch(() => {});
    }

    const today = todayKey();
    const now = new Date();

    const timers: ReturnType<typeof setTimeout>[] = [];

    for (const h of habits) {
      if (h.notifications_enabled === false) continue;
      if (!isDueOn(h, now)) continue;
      const times = h.reminder_times ?? [];
      for (const t of times) {
        const key = `${h.id}:${today}:${t}`;
        if (scheduled.current.has(key)) continue;
        const [hh, mm] = t.split(":").map(Number);
        if (Number.isNaN(hh) || Number.isNaN(mm)) continue;
        const at = new Date();
        at.setHours(hh, mm, 0, 0);
        const delay = at.getTime() - Date.now();
        if (delay < 0 || delay > 24 * 3600 * 1000) continue;
        scheduled.current.add(key);

        timers.push(setTimeout(async () => {
          // Check if already done
          const { data } = await supabase
            .from("me_habit_logs")
            .select("done")
            .eq("habit_id", h.id)
            .eq("log_date", today)
            .maybeSingle();
          if (data?.done) return;

          const msg = `${h.icon || "✨"} ${h.title} — time to check in!`;
          toast(msg, { description: `Reminder set for ${t}` });
          if ("Notification" in window && Notification.permission === "granted") {
            try {
              new Notification(h.title, { body: `Reminder at ${format(new Date(), "HH:mm")}`, icon: "/favicon.ico" });
            } catch {}
          }
        }, delay));
      }
    }

    return () => timers.forEach(clearTimeout);
  }, [habits, user?.id]);
}
