import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, MapPin, Globe, MessageSquarePlus, Activity, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { CreateInstituteDialog } from "@/components/CreateInstituteDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchInstitutes, fetchStages, type InstituteType } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { logAction } from "@/lib/access";
import { toast } from "sonner";

export function InstituteListPage({ type, title, subtitle }: { type: InstituteType; title: string; subtitle: string }) {
  const { data: list = [] } = useQuery({ queryKey: ["institutes", type], queryFn: () => fetchInstitutes(type) });
  const { data: stages = [] } = useQuery({ queryKey: ["stages"], queryFn: fetchStages });
  const [q, setQ] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");

  const qc = useQueryClient();
  const { user } = useAuth();
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const addNote = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      if (!noteText.trim()) return;
      const { error } = await supabase.from("outreach_activities").insert({
        institute_id: id, note: noteText.trim(), created_by: user?.id ?? null,
      });
      if (error) throw error;
      await logAction({ action: "note.added", entity_type: "institute", entity_id: id, entity_label: name });
    },
    onSuccess: () => {
      toast.success("Note added");
      setNoteFor(null); setNoteText("");
      qc.invalidateQueries({ queryKey: ["activities-all"] });
      qc.invalidateQueries({ queryKey: ["institute"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStage = useMutation({
    mutationFn: async ({ id, name, stageId }: { id: string; name: string; stageId: string }) => {
      const stage = stages.find((s) => s.id === stageId);
      const { error } = await supabase.from("institutes")
        .update({ current_stage_id: stageId, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      await supabase.from("outreach_activities").insert({
        institute_id: id, stage_id: stageId, stage_name_snapshot: stage?.name,
        note: `Stage updated → ${stage?.name}`, created_by: user?.id ?? null,
      });
      await logAction({ action: "stage.updated", entity_type: "institute", entity_id: id, entity_label: name, details: { stage: stage?.name } });
    },
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["institutes", type] });
      qc.invalidateQueries({ queryKey: ["activities-all"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = useMemo(() => list.filter((i) => {
    const m = q.trim().toLowerCase();
    if (stageFilter !== "all" && i.current_stage_id !== stageFilter) return false;
    if (!m) return true;
    return [i.name, i.city, i.state, i.contact_person].some((v) => v?.toLowerCase().includes(m));
  }), [list, q, stageFilter]);

  return (
    <RequireAuth perm={type === "college" ? "can_colleges" : "can_coaching"}>
      <AppShell title={title}>
        <div className="space-y-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h2 className="font-display text-2xl font-bold">{title}</h2>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
            <CreateInstituteDialog type={type} />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search by name, city, state…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="sm:w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <Card><CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-muted-foreground">No profiles yet.</p>
            </CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((i) => {
                const stage = stages.find((s) => s.id === i.current_stage_id);
                const idx = stage ? stages.findIndex((s) => s.id === stage.id) + 1 : 0;
                const pct = stages.length ? Math.round((idx / stages.length) * 100) : 0;
                const typePath = type === "college" ? "colleges" : "coaching";
                return (
                  <Card key={i.id} className="h-full transition-all hover:-translate-y-0.5 hover:shadow-lg" style={{ boxShadow: "var(--shadow-card)" }}>
                    <CardContent className="space-y-3 p-5">
                      <div className="flex items-start justify-between gap-2">
                        <Link to="/outreach/$type/$id" params={{ type: typePath, id: i.id }} className="hover:text-primary">
                          <h3 className="font-display text-lg font-semibold leading-tight">{i.name}</h3>
                        </Link>
                        {stage && <Badge style={{ background: `${stage.color}20`, color: stage.color, borderColor: `${stage.color}40` }} variant="outline">{stage.name}</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {(i.city || i.state) && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{[i.city, i.state].filter(Boolean).join(", ")}</span>}
                        {i.website && <span className="flex items-center gap-1"><Globe className="h-3 w-3" />Website</span>}
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Progress</span><span className="font-medium">{pct}%</span></div>
                        <Progress value={pct} className="h-1.5" />
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <Link to="/outreach/$type/$id" params={{ type: typePath, id: i.id }} className="text-xs font-medium text-primary hover:underline">Open profile →</Link>
                        <Popover open={noteFor === i.id} onOpenChange={(o) => { if (!o) { setNoteFor(null); setNoteText(""); } }}>
                          <PopoverTrigger asChild>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => { setNoteFor(i.id); setNoteText(""); }}>
                              <MessageSquarePlus className="mr-1 h-3 w-3" /> Add note
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-80">
                            <div className="space-y-2">
                              <p className="text-xs font-medium">New note for {i.name}</p>
                              <Textarea rows={3} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="What happened today?" />
                              <Button size="sm" className="w-full" disabled={addNote.isPending || !noteText.trim()} onClick={() => addNote.mutate({ id: i.id, name: i.name })}>Save note</Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
