import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export interface ConfDoc {
  id: string; user_id: string; name: string; category: string | null;
  link: string; notes: string | null; created_at: string;
}
export interface ConfPassword {
  id: string; user_id: string; name: string; category: string | null;
  username: string | null; password: string; url: string | null;
  notes: string | null; created_at: string;
}
export interface ConfApi {
  id: string; user_id: string; name: string; category: string | null;
  api_key: string; notes: string | null; created_at: string;
}

type Kind = "documents" | "passwords" | "apis";
const table = (k: Kind) =>
  k === "documents" ? "me_confidential_documents"
  : k === "passwords" ? "me_confidential_passwords"
  : "me_confidential_apis";

export function useConfList<T>(kind: Kind) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["conf", kind, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from(table(kind) as any)
        .select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as T[];
    },
  });
}

export function useConfSave(kind: Kind) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (payload: any) => {
      if (!user) throw new Error("Not signed in");
      const { id, ...rest } = payload;
      if (id) {
        const { error } = await supabase.from(table(kind) as any).update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(table(kind) as any)
          .insert({ ...rest, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conf", kind] });
      toast.success("Saved");
    },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });
}

export function useConfDelete(kind: Kind) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table(kind) as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conf", kind] });
      toast.success("Deleted");
    },
  });
}

export async function copyToClipboard(text: string, label = "Copied") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error("Copy failed");
  }
}
