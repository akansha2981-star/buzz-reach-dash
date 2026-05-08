import { supabase } from "@/integrations/supabase/client";

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
