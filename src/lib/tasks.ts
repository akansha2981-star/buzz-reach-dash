import { supabase } from "@/integrations/supabase/client";

export type RecurrenceFreq = "daily" | "weekly" | "monthly" | "yearly";
export type RecurrenceRule = { freq: RecurrenceFreq; interval: number };

export type Task = {
  id: string;
  institute_id: string | null;
  title: string;
  description: string | null;
  due_at: string | null;
  status: "pending" | "done";
  created_by: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
  recurrence_rule: RecurrenceRule | null;
  recurrence_parent_id: string | null;
};

export async function fetchTasks(filter?: { instituteId?: string; status?: "pending" | "done" }): Promise<Task[]> {
  let q = supabase.from("tasks").select("*").order("due_at", { ascending: true, nullsFirst: false });
  if (filter?.instituteId) q = q.eq("institute_id", filter.instituteId);
  if (filter?.status) q = q.eq("status", filter.status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Task[];
}

export async function fetchTasksWithInstitutes(): Promise<(Task & { institute?: { id: string; name: string; type: string } | null })[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*, institute:institutes(id, name, type)")
    .order("due_at", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as any;
}

export function nextDueDate(rule: RecurrenceRule, from: Date): Date {
  const d = new Date(from);
  const n = Math.max(1, rule.interval || 1);
  switch (rule.freq) {
    case "daily": d.setDate(d.getDate() + n); break;
    case "weekly": d.setDate(d.getDate() + 7 * n); break;
    case "monthly": d.setMonth(d.getMonth() + n); break;
    case "yearly": d.setFullYear(d.getFullYear() + n); break;
  }
  return d;
}

/** If the completed task is recurring, insert the next occurrence. */
export async function spawnNextOccurrence(task: Pick<Task, "id" | "institute_id" | "title" | "description" | "due_at" | "created_by" | "recurrence_rule" | "recurrence_parent_id">) {
  if (!task.recurrence_rule || !task.due_at) return;
  const next = nextDueDate(task.recurrence_rule as RecurrenceRule, new Date(task.due_at));
  const { error } = await supabase.from("tasks").insert({
    institute_id: task.institute_id,
    title: task.title,
    description: task.description,
    due_at: next.toISOString(),
    created_by: task.created_by,
    recurrence_rule: task.recurrence_rule as any,
    recurrence_parent_id: task.recurrence_parent_id ?? task.id,
  });
  if (error) throw error;
}
