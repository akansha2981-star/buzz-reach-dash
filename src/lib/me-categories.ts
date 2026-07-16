import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  Megaphone, Settings2, TrendingUp, Wallet, Users, Package, Palette,
  Code2, ClipboardList, Heart, Video, FlaskConical, Sparkles, Tag,
  type LucideIcon,
} from "lucide-react";

export type MeCategory = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

// Preset color palette for the picker
export const CATEGORY_COLORS = [
  "#ec4899", "#f43f5e", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4",
  "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7",
  "#d946ef", "#64748b", "#78716c",
];

// Icon registry — keys stored in db, resolved to component here
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  megaphone: Megaphone,
  settings: Settings2,
  trending: TrendingUp,
  wallet: Wallet,
  users: Users,
  package: Package,
  palette: Palette,
  code: Code2,
  clipboard: ClipboardList,
  heart: Heart,
  video: Video,
  flask: FlaskConical,
  sparkles: Sparkles,
  tag: Tag,
};

export const CATEGORY_ICON_KEYS = Object.keys(CATEGORY_ICONS);

export function iconFor(key?: string | null): LucideIcon {
  if (!key) return Tag;
  return CATEGORY_ICONS[key] ?? Tag;
}

// Default categories seeded into DB the first time a user opens the manager
export const DEFAULT_CATEGORIES: Array<Omit<MeCategory, "id" | "user_id" | "created_at" | "updated_at">> = [
  { name: "Marketing",   color: "#ec4899", icon: "megaphone",  sort_order: 0 },
  { name: "Operations",  color: "#3b82f6", icon: "settings",   sort_order: 1 },
  { name: "Sales",       color: "#10b981", icon: "trending",   sort_order: 2 },
  { name: "Finance",     color: "#f59e0b", icon: "wallet",     sort_order: 3 },
  { name: "HR",          color: "#a855f7", icon: "users",      sort_order: 4 },
  { name: "Product",     color: "#6366f1", icon: "package",    sort_order: 5 },
  { name: "Design",      color: "#d946ef", icon: "palette",    sort_order: 6 },
  { name: "Engineering", color: "#06b6d4", icon: "code",       sort_order: 7 },
  { name: "Personal",    color: "#14b8a6", icon: "heart",      sort_order: 8 },
  { name: "Meetings",    color: "#f97316", icon: "video",      sort_order: 9 },
];

// Tone helper (soft badge style) from hex color
export function toneStyle(color?: string | null): React.CSSProperties {
  const c = color || "#64748b";
  return {
    backgroundColor: `${c}22`,
    color: c,
    borderColor: `${c}55`,
  };
}

export function useMyCategories() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useQuery({
    queryKey: ["me-categories", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("me_categories")
        .select("*")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      let rows = (data ?? []) as MeCategory[];
      // Seed defaults on first use
      if (rows.length === 0 && user) {
        const payload = DEFAULT_CATEGORIES.map((d) => ({ ...d, user_id: user.id }));
        const { data: inserted, error: insErr } = await supabase
          .from("me_categories")
          .insert(payload)
          .select("*");
        if (insErr) {
          // If seeding failed (duplicate name race, etc.), silently return whatever's there
          const { data: retry } = await supabase.from("me_categories").select("*").order("sort_order");
          rows = (retry ?? []) as MeCategory[];
        } else {
          rows = (inserted ?? []) as MeCategory[];
          qc.invalidateQueries({ queryKey: ["me-categories", user.id] });
        }
      }
      return rows;
    },
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { name: string; color: string; icon?: string | null }) => {
      const name = input.name.trim();
      if (!name) throw new Error("Name required");
      const { data, error } = await supabase
        .from("me_categories")
        .insert({ user_id: user!.id, name, color: input.color, icon: input.icon ?? "tag" })
        .select("*")
        .single();
      if (error) throw error;
      return data as MeCategory;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me-categories", user?.id] });
      toast.success("Category created");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, patch, previousName }: { id: string; patch: Partial<MeCategory>; previousName?: string }) => {
      const { data, error } = await supabase
        .from("me_categories")
        .update(patch as any)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      // If renamed, cascade to tasks using the old name
      if (patch.name && previousName && patch.name !== previousName && user) {
        await supabase.from("me_tasks").update({ category: patch.name }).eq("user_id", user.id).eq("category", previousName);
      }
      return data as MeCategory;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me-categories", user?.id] });
      qc.invalidateQueries({ queryKey: ["me-tasks", user?.id] });
      toast.success("Category updated");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("me_categories").delete().eq("id", id);
      if (error) throw error;
      // Clear the category on tasks that referenced it
      if (user) {
        await supabase.from("me_tasks").update({ category: null }).eq("user_id", user.id).eq("category", name);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me-categories", user?.id] });
      qc.invalidateQueries({ queryKey: ["me-tasks", user?.id] });
      toast.success("Category deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });
}
