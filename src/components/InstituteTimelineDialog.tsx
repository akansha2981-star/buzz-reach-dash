import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { fetchStages } from "@/lib/data";
import { Activity } from "lucide-react";

export function InstituteTimelineDialog({ instituteId, instituteName, trigger }: { instituteId: string; instituteName: string; trigger: React.ReactNode }) {
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["institute-timeline", instituteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outreach_activities")
        .select("*")
        .eq("institute_id", instituteId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: stages = [] } = useQuery({ queryKey: ["stages"], queryFn: fetchStages });

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Activity className="h-4 w-4" /> Timeline · {instituteName}</DialogTitle>
          <DialogDescription>All notes & stage updates for this profile.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-3">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : activities.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ol className="relative space-y-4 border-l border-border pl-6">
              {activities.map((a: any) => {
                const stage = stages.find((s) => s.id === a.stage_id);
                return (
                  <li key={a.id} className="relative">
                    <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full ring-4 ring-background" style={{ background: stage?.color ?? "var(--primary)" }} />
                    <div className="flex flex-wrap items-center gap-2">
                      {a.stage_name_snapshot && <Badge variant="secondary">{a.stage_name_snapshot}</Badge>}
                      <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                    </div>
                    {a.note && <p className="mt-1 text-sm whitespace-pre-wrap">{a.note}</p>}
                  </li>
                );
              })}
            </ol>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
