import { useEffect, useRef } from "react";
import { addDays, addMonths, addWeeks, format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { normalizeRecurrenceFreq, recurrenceInterval, type RecurrenceRule } from "@/lib/me";

/**
 * Ensures that every recurring task has an instance for today's local date.
 * Runs once per session per user. Called from MeShell so it fires whenever
 * the workspace opens (which effectively "runs at 12:00 AM" the next time
 * the user visits after midnight).
 */
export function useRecurringSpawner() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const ran = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let midnightTimer: ReturnType<typeof setTimeout> | null = null;

    const syncRecurringTasks = async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const key = `${user.id}:${today}`;
      if (ran.current === key) return;
      ran.current = key;

      // ── 1. Roll over incomplete non-recurring tasks whose due_date is in the past.
      //    Their due_date is bumped to today so they appear in Today automatically
      //    and keep shifting forward each day until the user completes or deletes them.
      const { data: overdue } = await supabase
        .from("me_tasks")
        .select("id")
        .lt("due_date", today)
        .is("recurrence_rule", null)
        .neq("status", "completed");
      if (overdue && overdue.length > 0) {
        await supabase
          .from("me_tasks")
          .update({ due_date: today })
          .in("id", overdue.map((t: any) => t.id));
      }


      // Fetch all tasks with a recurrence rule for this user
      const { data, error } = await supabase
        .from("me_tasks")
        .select("*")
        .not("recurrence_rule", "is", null);
      if (error || !data) return;

      // Group by "template id" = recurrence_parent_id ?? id
      const groups = new Map<string, any[]>();
      for (const t of data) {
        const gid = (t as any).recurrence_parent_id ?? t.id;
        const arr = groups.get(gid) ?? [];
        arr.push(t);
        groups.set(gid, arr);
      }

      let spawned = 0;
      for (const [gid, items] of groups) {
        // Skip if any instance already exists for today
        if (items.some((t) => t.due_date === today)) continue;

        // Find the most recent instance to use as the template
        const sorted = [...items].sort((a, b) => getRecurringAnchorDate(b).localeCompare(getRecurringAnchorDate(a)));
        const template = sorted[0];
        const rule = template.recurrence_rule as RecurrenceRule | null;
        const freq = normalizeRecurrenceFreq(rule);
        if (!rule || !freq) continue;

        // Walk occurrences forward from the template's due_date until we reach or pass today
        const anchorDate = getRecurringAnchorDate(template);
        let cur = parseISO(anchorDate);
        const todayD = parseISO(today);
        const interval = recurrenceInterval(rule);
        let safety = 400;
        let matched = false;
        while (cur <= todayD && safety-- > 0) {
          if (format(cur, "yyyy-MM-dd") === today) {
            matched = true;
            break;
          }
          if (freq === "daily") cur = addDays(cur, 1);
          else if (freq === "weekly") cur = addWeeks(cur, interval);
          else if (freq === "monthly") cur = addMonths(cur, interval);
          else cur = addDays(cur, interval);
        }
        // Daily means every calendar day, regardless of any old interval value.
        if (!matched && freq === "daily" && parseISO(anchorDate) <= todayD) matched = true;
        if (!matched) continue;

        const { error: insErr } = await supabase.from("me_tasks").insert({
          user_id: user.id,
          title: template.title,
          description: template.description,
          priority: template.priority,
          due_date: today,
          due_time: template.due_time,
          category: template.category,
          tags: template.tags,
          estimated_minutes: template.estimated_minutes,
          recurrence_rule: template.recurrence_rule,
          recurrence_parent_id: gid,
          status: "pending",
        });
        if (!insErr) spawned++;
      }

      if (spawned > 0) {
        qc.invalidateQueries({ queryKey: ["me-tasks", user.id] });
      }

      if (!cancelled) {
        qc.invalidateQueries({ queryKey: ["me-tasks", user.id] });
      }
    };

    const scheduleMidnightSync = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setDate(now.getDate() + 1);
      nextMidnight.setHours(0, 0, 5, 0);
      midnightTimer = setTimeout(async () => {
        ran.current = null;
        await syncRecurringTasks();
        if (!cancelled) scheduleMidnightSync();
      }, Math.max(1000, nextMidnight.getTime() - now.getTime()));
    };

    syncRecurringTasks();
    scheduleMidnightSync();

    return () => {
      cancelled = true;
      if (midnightTimer) clearTimeout(midnightTimer);
    };
  }, [user, qc]);
}

function getRecurringAnchorDate(task: any) {
  return task.due_date ?? task.created_at?.slice(0, 10) ?? format(new Date(), "yyyy-MM-dd");
}
