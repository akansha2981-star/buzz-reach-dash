import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Tags, FolderPlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

export type TagCategory = Database["public"]["Tables"]["lms_tag_categories"]["Row"];
export type LmsTag = Database["public"]["Tables"]["lms_tags"]["Row"];

export const TAG_COLORS = ["#0f766e", "#1d4ed8", "#b45309", "#be123c", "#6d28d9", "#047857", "#c2410c", "#334155"];

export function useTagData() {
  const categories = useQuery({
    queryKey: ["lms_tag_categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lms_tag_categories").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const tags = useQuery({
    queryKey: ["lms_tags"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lms_tags").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  return { categories: categories.data ?? [], tags: tags.data ?? [], isLoading: categories.isLoading || tags.isLoading };
}

export function TagManagerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const { categories, tags } = useTagData();
  const [catName, setCatName] = useState("");
  const [catColor, setCatColor] = useState(TAG_COLORS[0]);
  const [tagNames, setTagNames] = useState<Record<string, string>>({});

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["lms_tag_categories"] });
    qc.invalidateQueries({ queryKey: ["lms_tags"] });
  };

  const addCategory = useMutation({
    mutationFn: async () => {
      if (!catName.trim()) throw new Error("Enter a category name.");
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("lms_tag_categories").insert({ name: catName.trim(), color: catColor, created_by: user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setCatName(""); toast.success("Category created"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lms_tag_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Category and its tags deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addTag = useMutation({
    mutationFn: async ({ categoryId, name }: { categoryId: string; name: string }) => {
      if (!name.trim()) throw new Error("Enter a tag name.");
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("lms_tags").insert({ category_id: categoryId, name: name.trim(), created_by: user?.id ?? null });
      if (error) {
        if (error.code === "23505") throw new Error("That tag already exists in this category.");
        throw error;
      }
    },
    onSuccess: (_d, v) => { invalidate(); setTagNames((m) => ({ ...m, [v.categoryId]: "" })); toast.success("Tag added"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeTag = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lms_tags").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Tag deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Tags className="h-4 w-4" />Tags & categories</DialogTitle>
          <DialogDescription>Create categories, add tags inside them, then attach any number of tags to your data.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-md border border-border p-3">
          <Label>New category</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input placeholder="e.g. Lead quality" value={catName} onChange={(e) => setCatName(e.target.value)} className="w-full sm:w-48" />
            <div className="flex items-center gap-1.5">
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  onClick={() => setCatColor(c)}
                  className={`h-6 w-6 rounded-full border-2 ${catColor === c ? "border-foreground" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <Button size="sm" disabled={addCategory.isPending || !catName.trim()} onClick={() => addCategory.mutate()}>
              <FolderPlus className="mr-1.5 h-4 w-4" />Add
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {categories.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No categories yet — create one above.</p>}
          {categories.map((cat) => {
            const catTags = tags.filter((t) => t.category_id === cat.id);
            return (
              <div key={cat.id} className="space-y-2 rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color }} />
                    {cat.name}
                  </span>
                  <Button size="icon" variant="ghost" aria-label={`Delete category ${cat.name}`} title="Delete category and its tags" onClick={() => removeCategory.mutate(cat.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {catTags.length === 0 && <span className="text-xs text-muted-foreground">No tags yet.</span>}
                  {catTags.map((t) => (
                    <Badge key={t.id} variant="secondary" className="gap-1 pr-1">
                      {t.name}
                      <button type="button" aria-label={`Delete tag ${t.name}`} onClick={() => removeTag.mutate(t.id)} className="rounded-full p-0.5 hover:bg-foreground/10">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="New tag name"
                    value={tagNames[cat.id] ?? ""}
                    onChange={(e) => setTagNames((m) => ({ ...m, [cat.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag.mutate({ categoryId: cat.id, name: tagNames[cat.id] ?? "" }); } }}
                    className="h-8 text-sm"
                  />
                  <Button size="sm" variant="outline" disabled={addTag.isPending || !(tagNames[cat.id] ?? "").trim()} onClick={() => addTag.mutate({ categoryId: cat.id, name: tagNames[cat.id] ?? "" })}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
