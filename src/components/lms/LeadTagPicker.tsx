import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Tags, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { useTagData } from "./TagManager";

/** Chip button + popover to attach/detach any number of tags on one lead. */
export function LeadTagPicker({ leadId }: { leadId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { categories, tags } = useTagData();

  const assigned = useQuery({
    queryKey: ["lms_lead_tags", leadId],
    queryFn: async () => {
      const { data, error } = await supabase.from("lms_lead_tags").select("tag_id").eq("lead_id", leadId);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.tag_id));
    },
  });
  const selected = assigned.data ?? new Set<string>();

  const toggle = useMutation({
    mutationFn: async ({ tagId, on }: { tagId: string; on: boolean }) => {
      if (on) {
        const { error } = await supabase.from("lms_lead_tags").insert({ lead_id: leadId, tag_id: tagId });
        if (error && error.code !== "23505") throw error;
      } else {
        const { error } = await supabase.from("lms_lead_tags").delete().eq("lead_id", leadId).eq("tag_id", tagId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lms_lead_tags", leadId] });
      qc.invalidateQueries({ queryKey: ["lms_lead_tags_all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 gap-1.5 px-2 text-xs" aria-label="Manage tags">
          <Tags className="h-3.5 w-3.5" />
          Tags{selected.size > 0 ? ` (${selected.size})` : ""}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="max-h-80 w-72 overflow-y-auto p-3" align="end">
        {categories.length === 0 ? (
          <p className="text-xs text-muted-foreground">No tags yet — create categories and tags from the Tags button at the top.</p>
        ) : (
          <div className="space-y-3">
            {categories.map((cat) => {
              const catTags = tags.filter((t) => t.category_id === cat.id);
              if (catTags.length === 0) return null;
              return (
                <div key={cat.id} className="space-y-1.5">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    {cat.name}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {catTags.map((t) => {
                      const on = selected.has(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggle.mutate({ tagId: t.id, on: !on })}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${on ? "border-transparent text-white" : "border-border text-foreground hover:bg-muted"}`}
                          style={on ? { backgroundColor: cat.color } : undefined}
                        >
                          {on && <Check className="h-3 w-3" />}
                          {t.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Small read-only badges showing a lead's current tags (used in the list row). */
export function LeadTagBadges({ leadId }: { leadId: string }) {
  const { categories, tags } = useTagData();
  const assigned = useQuery({
    queryKey: ["lms_lead_tags", leadId],
    queryFn: async () => {
      const { data, error } = await supabase.from("lms_lead_tags").select("tag_id").eq("lead_id", leadId);
      if (error) throw error;
      return (data ?? []).map((r) => r.tag_id);
    },
  });
  const ids = assigned.data ?? [];
  if (ids.length === 0) return null;
  const colorOf = (tagId: string) => {
    const tag = tags.find((t) => t.id === tagId);
    return categories.find((c) => c.id === tag?.category_id)?.color ?? "#334155";
  };
  return (
    <div className="flex flex-wrap gap-1">
      {ids.map((id) => {
        const tag = tags.find((t) => t.id === id);
        if (!tag) return null;
        return (
          <Badge key={id} className="border-transparent text-[10px] text-white" style={{ backgroundColor: colorOf(id) }}>
            {tag.name}
          </Badge>
        );
      })}
    </div>
  );
}
