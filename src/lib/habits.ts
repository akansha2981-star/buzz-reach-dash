import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { format, parseISO, addDays, differenceInCalendarDays } from "date-fns";
import { toast } from "sonner";

export type HabitFrequency = "daily" | "weekly" | "custom";
export type HabitFieldType =
  | "number"
  | "decimal"
  | "time"
  | "duration"
  | "distance"
  | "weight"
  | "calories"
  | "water"
  | "custom";

export interface Habit {
  id: string;
  user_id: string;
  title: string;
  color: string;
  icon: string | null;
  category: string | null;
  start_date: string | null;
  reminder_times: string[] | null;
  frequency: HabitFrequency;
  custom_days: number[] | null;
  target_per_week: number;
  archived: boolean;
  notes: string | null;
  active: boolean;
  created_at: string;
}

export interface HabitField {
  id: string;
  habit_id: string;
  user_id: string;
  key: string;
  label: string;
  type: HabitFieldType;
  unit: string | null;
  target_value: number | null;
  target_period: "day" | "week" | "month" | null;
  sort_order: number;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  user_id: string;
  log_date: string;
  done: boolean;
  values: Record<string, number | string | null>;
  notes: string | null;
}

export const FIELD_TYPE_META: Record<HabitFieldType, { label: string; unit: string; icon: string }> = {
  number: { label: "Number", unit: "", icon: "🔢" },
  decimal: { label: "Decimal", unit: "", icon: "📐" },
  time: { label: "Time", unit: "HH:mm", icon: "🕐" },
  duration: { label: "Duration", unit: "min", icon: "⏱️" },
  distance: { label: "Distance", unit: "km", icon: "📏" },
  weight: { label: "Weight", unit: "kg", icon: "⚖️" },
  calories: { label: "Calories", unit: "kcal", icon: "🔥" },
  water: { label: "Water", unit: "L", icon: "💧" },
  custom: { label: "Custom", unit: "", icon: "✨" },
};

export function useHabitsAdv() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["habits-adv", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("me_habits")
        .select("*")
        .eq("archived", false)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Habit[];
    },
  });
}

export function useHabit(habitId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["habit-adv", user?.id, habitId],
    enabled: !!user && !!habitId,
    queryFn: async () => {
      const { data, error } = await supabase.from("me_habits").select("*").eq("id", habitId!).maybeSingle();
      if (error) throw error;
      return data as unknown as Habit | null;
    },
  });
}

export function useHabitFields(habitId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["habit-fields", user?.id, habitId ?? "all"],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("me_habit_fields" as any).select("*").order("sort_order");
      if (habitId) q = q.eq("habit_id", habitId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as HabitField[];
    },
  });
}

export function useHabitLogsAdv(habitId?: string, days = 120) {
  const { user } = useAuth();
  const since = format(addDays(new Date(), -days), "yyyy-MM-dd");
  return useQuery({
    queryKey: ["habit-logs-adv", user?.id, habitId ?? "all", since],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("me_habit_logs").select("*").gte("log_date", since);
      if (habitId) q = q.eq("habit_id", habitId);
      const { data, error } = await q.order("log_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as HabitLog[];
    },
  });
}

export function useSaveHabit() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (payload: {
      id?: string;
      habit: Partial<Habit>;
      fields: Array<Partial<HabitField> & { _delete?: boolean }>;
    }) => {
      if (!user) throw new Error("Not signed in");
      let habitId = payload.id;
      const habitData: any = {
        ...payload.habit,
        user_id: user.id,
      };
      // ensure required cols
      if (!habitData.target_per_week) habitData.target_per_week = 7;
      if (!habitData.color) habitData.color = "hsl(var(--primary))";
      if (!habitData.active) habitData.active = true;

      if (habitId) {
        const { error } = await supabase.from("me_habits").update(habitData).eq("id", habitId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("me_habits").insert(habitData).select("id").single();
        if (error) throw error;
        habitId = data!.id;
      }
      // Sync fields
      for (const f of payload.fields) {
        if (f._delete && f.id) {
          await supabase.from("me_habit_fields" as any).delete().eq("id", f.id);
          continue;
        }
        const row: any = {
          habit_id: habitId,
          user_id: user.id,
          key: f.key,
          label: f.label,
          type: f.type,
          unit: f.unit ?? null,
          target_value: f.target_value ?? null,
          target_period: f.target_period ?? "day",
          sort_order: f.sort_order ?? 0,
        };
        if (f.id) {
          await supabase.from("me_habit_fields" as any).update(row).eq("id", f.id);
        } else {
          await supabase.from("me_habit_fields" as any).insert(row);
        }
      }
      return habitId!;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits-adv"] });
      qc.invalidateQueries({ queryKey: ["habit-fields"] });
      qc.invalidateQueries({ queryKey: ["habit-adv"] });
      toast.success("Habit saved");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save habit"),
  });
}

export function useDeleteHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("me_habits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habits-adv"] });
      toast.success("Habit deleted");
    },
  });
}

export function useUpsertLog() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (payload: {
      habit_id: string;
      log_date: string;
      done: boolean;
      values?: Record<string, any>;
      notes?: string | null;
    }) => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("me_habit_logs")
        .upsert(
          {
            habit_id: payload.habit_id,
            user_id: user.id,
            log_date: payload.log_date,
            done: payload.done,
            values: (payload.values ?? {}) as any,
            notes: payload.notes ?? null,
          } as any,
          { onConflict: "habit_id,log_date" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habit-logs-adv"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });
}

// ---- helpers ----
export function isDueOn(habit: Habit, day: Date): boolean {
  const dow = day.getDay();
  if (habit.frequency === "daily") return true;
  if (habit.frequency === "weekly") return dow === 1; // Monday
  if (habit.frequency === "custom") return (habit.custom_days ?? []).includes(dow);
  return true;
}

export function currentStreak(habit: Habit, logs: HabitLog[]): number {
  const done = new Set(logs.filter((l) => l.habit_id === habit.id && l.done).map((l) => l.log_date));
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = addDays(new Date(), -i);
    if (!isDueOn(habit, d)) continue;
    const key = format(d, "yyyy-MM-dd");
    if (done.has(key)) streak++;
    else if (i === 0) continue; // grace for today
    else break;
  }
  return streak;
}

export function longestStreak(habit: Habit, logs: HabitLog[]): number {
  const done = new Set(logs.filter((l) => l.habit_id === habit.id && l.done).map((l) => l.log_date));
  const start = habit.start_date ? parseISO(habit.start_date) : addDays(new Date(), -120);
  const days = Math.max(1, differenceInCalendarDays(new Date(), start));
  let best = 0, cur = 0;
  for (let i = days; i >= 0; i--) {
    const d = addDays(start, i);
    if (!isDueOn(habit, d)) continue;
    if (done.has(format(d, "yyyy-MM-dd"))) {
      cur++;
      if (cur > best) best = cur;
    } else cur = 0;
  }
  return best;
}

export function completionRate(habit: Habit, logs: HabitLog[], days = 30): number {
  let due = 0, done = 0;
  const doneSet = new Set(logs.filter((l) => l.habit_id === habit.id && l.done).map((l) => l.log_date));
  for (let i = 0; i < days; i++) {
    const d = addDays(new Date(), -i);
    if (!isDueOn(habit, d)) continue;
    due++;
    if (doneSet.has(format(d, "yyyy-MM-dd"))) done++;
  }
  return due === 0 ? 0 : Math.round((done / due) * 100);
}

export function todayKey() {
  return format(new Date(), "yyyy-MM-dd");
}
export function yesterdayKey() {
  return format(addDays(new Date(), -1), "yyyy-MM-dd");
}
