import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { addDays, addMonths, addWeeks, format, parseISO, startOfDay, isBefore, isToday as fnsIsToday } from "date-fns";
import { toast } from "sonner";

export type MeTaskStatus = "pending" | "in_progress" | "completed" | "delayed" | "overdue";
export type MeTaskPriority = "low" | "medium" | "high" | "urgent";
export type MeFocusType = "pomodoro" | "short_break" | "long_break" | "focus";

export type RecurrenceFreq = "daily" | "weekly" | "monthly" | "custom";
export type RecurrenceRule = {
  freq: RecurrenceFreq;
  interval: number; // every N units
  byDay?: number[]; // 0-6 for weekly
};

export type MeTask = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: MeTaskStatus;
  priority: MeTaskPriority;
  due_date: string | null;
  due_time: string | null;
  reminder_at: string | null;
  category: string | null;
  tags: string[];
  estimated_minutes: number | null;
  completed_at: string | null;
  recurrence_rule: RecurrenceRule | null;
  recurrence_parent_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export type MeNotification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  task_id: string | null;
  scheduled_for: string | null;
  read_at: string | null;
  created_at: string;
};

export const PRIORITY_TONES: Record<MeTaskPriority, string> = {
  low: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30",
  medium: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30",
  high: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  urgent: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
};

export const STATUS_TONES: Record<MeTaskStatus, string> = {
  pending: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30",
  in_progress: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  completed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  delayed: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  overdue: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
};

export function deriveStatus(t: Pick<MeTask, "status" | "due_date" | "due_time">): MeTaskStatus {
  if (t.status === "completed") return "completed";
  if (t.due_date) {
    const today = startOfDay(new Date());
    const d = startOfDay(parseISO(t.due_date));
    if (isBefore(d, today)) return "overdue";
    // Same day: if a time is set and it has passed, mark overdue
    if (d.getTime() === today.getTime() && t.due_time) {
      const [h, m] = t.due_time.split(":").map(Number);
      const dueAt = new Date();
      dueAt.setHours(h || 0, m || 0, 0, 0);
      if (dueAt.getTime() < Date.now()) return "overdue";
    }
  }
  return t.status;
}


export function nextOccurrence(rule: RecurrenceRule, from: Date): Date {
  const i = Math.max(1, rule.interval || 1);
  if (rule.freq === "daily") return addDays(from, i);
  if (rule.freq === "weekly") return addWeeks(from, i);
  if (rule.freq === "monthly") return addMonths(from, i);
  return addDays(from, i);
}

export function useMyTasks() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["me-tasks", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("me_tasks").select("*").order("position").order("due_date", { nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as MeTask[];
    },
  });
}

export function useTodayTasks() {
  const q = useMyTasks();
  const today = format(new Date(), "yyyy-MM-dd");
  // Today = due today + overdue pending + undated pending (all active work for today)
  const data = (q.data ?? [])
    .filter((t) => {
      if (t.status === "completed") return t.due_date === today || (t.completed_at ?? "").slice(0, 10) === today;
      if (!t.due_date) return true; // undated pending → show in Today
      return t.due_date <= today; // due today or overdue
    })
    .sort((a, b) => {
      // Order: overdue first, then by due_time asc (nulls last), then by priority
      const aOver = a.due_date && a.due_date < today ? 0 : 1;
      const bOver = b.due_date && b.due_date < today ? 0 : 1;
      if (aOver !== bOver) return aOver - bOver;
      const at = a.due_time ?? "99:99";
      const bt = b.due_time ?? "99:99";
      if (at !== bt) return at.localeCompare(bt);
      const pr = { urgent: 0, high: 1, medium: 2, low: 3 } as const;
      return pr[a.priority] - pr[b.priority];
    });
  return { ...q, data };
}

export function useUpcomingTasks(days = 7) {
  const q = useMyTasks();
  const start = format(new Date(), "yyyy-MM-dd");
  const end = format(addDays(new Date(), days), "yyyy-MM-dd");
  return {
    ...q,
    data: (q.data ?? []).filter((t) => t.due_date && t.due_date >= start && t.due_date <= end && t.status !== "completed"),
  };
}

export function useCreateTask() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: Partial<MeTask> & { title: string }) => {
      const payload: any = { ...input, user_id: user!.id };
      const { data, error } = await supabase.from("me_tasks").insert(payload).select("*").single();
      if (error) throw error;
      return data as MeTask;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me-tasks", user?.id] });
      toast.success("Task added");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<MeTask> & { id: string }) => {
      const { error } = await supabase.from("me_tasks").update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me-tasks", user?.id] }),
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("me_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me-tasks", user?.id] });
      toast.success("Deleted");
    },
  });
}

export function useToggleComplete() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (task: MeTask) => {
      const completing = task.status !== "completed";
      const patch: any = completing
        ? { status: "completed", completed_at: new Date().toISOString() }
        : { status: "pending", completed_at: null };
      const { error } = await supabase.from("me_tasks").update(patch).eq("id", task.id);
      if (error) throw error;
      if (completing && task.recurrence_rule && task.due_date) {
        const next = nextOccurrence(task.recurrence_rule, parseISO(task.due_date));
        const { error: insErr } = await supabase.from("me_tasks").insert({
          user_id: user!.id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          due_date: format(next, "yyyy-MM-dd"),
          due_time: task.due_time,
          category: task.category,
          tags: task.tags,
          estimated_minutes: task.estimated_minutes,
          recurrence_rule: task.recurrence_rule as any,
          recurrence_parent_id: task.recurrence_parent_id ?? task.id,
        });
        if (insErr) throw insErr;
      }
    },
    onMutate: async (task: MeTask) => {
      const key = ["me-tasks", user?.id];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<MeTask[]>(key);
      const completing = task.status !== "completed";
      qc.setQueryData<MeTask[]>(key, (old) =>
        (old ?? []).map((t) =>
          t.id === task.id
            ? { ...t, status: completing ? "completed" : "pending", completed_at: completing ? new Date().toISOString() : null }
            : t
        )
      );
      return { prev };
    },
    onError: (_e, _t, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(["me-tasks", user?.id], ctx.prev);
      toast.error("Could not update task");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["me-tasks", user?.id] }),
  });
}

export function useNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["me-notif", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("me_notifications").select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return (data ?? []) as MeNotification[];
    },
  });
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`me-notif-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "me_notifications", filter: `user_id=eq.${user.id}` }, (p) => {
        const n = p.new as MeNotification;
        toast(n.title, { description: n.body ?? undefined });
        qc.invalidateQueries({ queryKey: ["me-notif", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);
  return q;
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("me_notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me-notif", user?.id] }),
  });
}

export function useHabits() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["me-habits", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("me_habits").select("*").order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useHabitLogs(days = 14) {
  const { user } = useAuth();
  const since = format(addDays(new Date(), -days), "yyyy-MM-dd");
  return useQuery({
    queryKey: ["me-habit-logs", user?.id, since],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("me_habit_logs").select("*").gte("log_date", since);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useFocusSessions(days = 30) {
  const { user } = useAuth();
  const since = new Date(Date.now() - days * 86400000).toISOString();
  return useQuery({
    queryKey: ["me-focus", user?.id, since],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("me_focus_sessions").select("*").gte("started_at", since).order("started_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useBadges() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["me-badges", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("me_badges").select("*").order("earned_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function isToday(d?: string | null) {
  if (!d) return false;
  return fnsIsToday(parseISO(d));
}
