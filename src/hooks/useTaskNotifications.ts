import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { isPast, isToday } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type LiteTask = { id: string; status: "pending" | "done"; due_at: string | null };

export function useTaskNotifications() {
  const { user } = useAuth();
  const notified = useRef(false);
  const { data: tasks = [] } = useQuery<LiteTask[]>({
    queryKey: ["tasks-notifications"],
    enabled: !!user,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, status, due_at")
        .eq("status", "pending");
      if (error) throw error;
      return (data ?? []) as LiteTask[];
    },
  });

  useEffect(() => {
    if (!user || notified.current || tasks.length === 0) return;
    const overdue = tasks.filter((t) => t.due_at && isPast(new Date(t.due_at)) && !isToday(new Date(t.due_at)));
    const today = tasks.filter((t) => t.due_at && isToday(new Date(t.due_at)));
    if (overdue.length > 0) {
      toast.warning(`${overdue.length} overdue task${overdue.length > 1 ? "s" : ""}`, {
        description: "Open the Tasks tab to review and complete them.",
        duration: 6000,
      });
    } else if (today.length > 0) {
      toast(`${today.length} task${today.length > 1 ? "s" : ""} due today`, { duration: 5000 });
    }
    notified.current = true;
  }, [tasks, user]);

  const pendingCount = tasks.length;
  const overdueCount = tasks.filter((t) => t.due_at && isPast(new Date(t.due_at)) && !isToday(new Date(t.due_at))).length;
  return { pendingCount, overdueCount };
}
