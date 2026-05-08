import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, MapPin, Globe, MessageSquarePlus, Activity, ChevronRight, CalendarPlus, X, AlertTriangle, LayoutGrid, List, Table as TableIcon } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { CreateInstituteDialog } from "@/components/CreateInstituteDialog";
import { MeetingDialog } from "@/routes/meetings";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { fetchInstitutes, fetchStages, type InstituteType } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { logAction } from "@/lib/access";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/useRealtime";
import { InstituteTimelineDialog } from "@/components/InstituteTimelineDialog";
import { AddTaskPopover } from "@/components/AddTaskPopover";
import { EditInstituteDialog, DeleteInstituteButton } from "@/components/EditInstituteDialog";

export function InstituteListPage({ type, title, subtitle }: { type: InstituteType; title: string; subtitle: string }) {
  useRealtime("institutes", [["institutes", type], ["dashboard"]]);
  useRealtime("outreach_activities", [["activities-all"], ["institute"], ["last-activity-map", type]]);
  useRealtime("outreach_stages", [["stages"]]);
  const { data: list = [] } = useQuery({ queryKey: ["institutes", type], queryFn: () => fetchInstitutes(type) });
  const { data: stages = [] } = useQuery({ queryKey: ["stages"], queryFn: fetchStages });
  const { data: lastActivityMap = {} } = useQuery({
    queryKey: ["last-activity-map", type],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outreach_activities")
        .select("institute_id, created_at")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data ?? []).forEach((a: any) => { if (!map[a.institute_id]) map[a.institute_id] = a.created_at; });
      return map;
    },
  });
  const [q, setQ] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"recent" | "name" | "stage" | "meeting">("recent");
  const [view, setView] = useState<"grid" | "list" | "table" | "compact">(() => {
    if (typeof window === "undefined") return "grid";
    return (localStorage.getItem(`institute-view:${type}`) as any) || "grid";
  });
  const setViewPersist = (v: "grid" | "list" | "table" | "compact") => {
    setView(v);
    if (typeof window !== "undefined") localStorage.setItem(`institute-view:${type}`, v);
  };

  const qc = useQueryClient();
  const { user } = useAuth();
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  // Stage change confirmation (requires note)
  const [stageChange, setStageChange] = useState<{ id: string; name: string; stageId: string; stageName: string } | null>(null);
  const [stageNote, setStageNote] = useState("");

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
    mutationFn: async ({ id, name, stageId, note }: { id: string; name: string; stageId: string; note: string }) => {
      const stage = stages.find((s) => s.id === stageId);
      const { error } = await supabase.from("institutes")
        .update({ current_stage_id: stageId, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      await supabase.from("outreach_activities").insert({
        institute_id: id, stage_id: stageId, stage_name_snapshot: stage?.name,
        note: `Stage → ${stage?.name}: ${note.trim()}`, created_by: user?.id ?? null,
      });
      await logAction({ action: "stage.updated", entity_type: "institute", entity_id: id, entity_label: name, details: { stage: stage?.name, note } });
    },
    onSuccess: () => {
      toast.success("Status updated");
      setStageChange(null); setStageNote("");
      qc.invalidateQueries({ queryKey: ["institutes", type] });
      qc.invalidateQueries({ queryKey: ["activities-all"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cities = useMemo(() => Array.from(new Set(list.map((i) => i.city).filter(Boolean))).sort() as string[], [list]);
  const states = useMemo(() => Array.from(new Set(list.map((i) => i.state).filter(Boolean))).sort() as string[], [list]);

  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  const isStale = (i: any) => {
    if (!i.current_stage_id) return false;
    const last = lastActivityMap[i.id];
    const ref = last ? new Date(last) : new Date(i.updated_at ?? i.created_at);
    return Date.now() - ref.getTime() > SEVEN_DAYS;
  };

  const filtered = useMemo(() => {
    const m = q.trim().toLowerCase();
    let out = list.filter((i) => {
      if (stageFilter !== "all" && i.current_stage_id !== stageFilter) return false;
      if (stageFilter === "none" && i.current_stage_id) return false;
      if (cityFilter !== "all" && i.city !== cityFilter) return false;
      if (stateFilter !== "all" && i.state !== stateFilter) return false;
      if (!m) return true;
      return [i.name, i.city, i.state, i.contact_person].some((v) => v?.toLowerCase().includes(m));
    });
    out = [...out].sort((a, b) => {
      // Stale always first (red alert items)
      const sa = isStale(a) ? 1 : 0;
      const sb = isStale(b) ? 1 : 0;
      if (sa !== sb) return sb - sa;
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "stage") {
        const ai = stages.findIndex((s) => s.id === a.current_stage_id);
        const bi = stages.findIndex((s) => s.id === b.current_stage_id);
        return bi - ai;
      }
      if (sortBy === "meeting") {
        const at = a.next_meeting_at ? +new Date(a.next_meeting_at) : Infinity;
        const bt = b.next_meeting_at ? +new Date(b.next_meeting_at) : Infinity;
        return at - bt;
      }
      return +new Date(b.updated_at ?? b.created_at) - +new Date(a.updated_at ?? a.created_at);
    });
    return out;
  }, [list, q, stageFilter, cityFilter, stateFilter, sortBy, stages, lastActivityMap]);

  const staleCount = useMemo(() => list.filter(isStale).length, [list, lastActivityMap]);

  const activeFilterCount = [stageFilter, cityFilter, stateFilter].filter((v) => v !== "all").length;
  const clearFilters = () => { setStageFilter("all"); setCityFilter("all"); setStateFilter("all"); setQ(""); };

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

          <div className="space-y-3 rounded-xl border bg-card/40 p-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search by name, city, state, contact…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Recently updated</SelectItem>
                  <SelectItem value="name">Name (A–Z)</SelectItem>
                  <SelectItem value="stage">Stage (latest)</SelectItem>
                  <SelectItem value="meeting">Next meeting</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="h-8 w-auto gap-1 px-3 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stages</SelectItem>
                  <SelectItem value="none">No stage set</SelectItem>
                  {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger className="h-8 w-auto gap-1 px-3 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All cities</SelectItem>
                  {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger className="h-8 w-auto gap-1 px-3 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All states</SelectItem>
                  {states.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              {(activeFilterCount > 0 || q) && (
                <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs" onClick={clearFilters}>
                  <X className="h-3 w-3" /> Clear
                </Button>
              )}
              <span className="ml-auto self-center text-xs text-muted-foreground">{filtered.length} of {list.length}</span>
              <ToggleGroup type="single" size="sm" value={view} onValueChange={(v) => v && setViewPersist(v as any)} className="ml-2">
                <ToggleGroupItem value="grid" aria-label="Grid view" className="h-8 px-2"><LayoutGrid className="h-4 w-4" /></ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label="List view" className="h-8 px-2"><List className="h-4 w-4" /></ToggleGroupItem>
                <ToggleGroupItem value="table" aria-label="Table view" className="h-8 px-2"><TableIcon className="h-4 w-4" /></ToggleGroupItem>
                <ToggleGroupItem value="compact" aria-label="Compact view" className="h-8 px-2 text-[10px] font-bold">XS</ToggleGroupItem>
              </ToggleGroup>
            </div>
            {staleCount > 0 && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                <AlertTriangle className="h-4 w-4 animate-pulse" />
                {staleCount} {staleCount === 1 ? "profile needs" : "profiles need"} attention — no activity in 7+ days. Pinned to top.
              </div>
            )}
          </div>

          {filtered.length === 0 ? (
            <Card><CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-muted-foreground">No profiles yet.</p>
            </CardContent></Card>
          ) : view === "grid" ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((i) => {
                const stage = stages.find((s) => s.id === i.current_stage_id);
                const idx = stage ? stages.findIndex((s) => s.id === stage.id) + 1 : 0;
                const pct = stages.length ? Math.round((idx / stages.length) * 100) : 0;
                const typePath = type === "college" ? "colleges" : "coaching";
                const accent = stage?.color ?? "hsl(var(--primary))";
                const stale = isStale(i);
                const lastAct = lastActivityMap[i.id];
                const daysSince = lastAct ? Math.floor((Date.now() - new Date(lastAct).getTime()) / 86400000) : null;
                return (
                  <Card key={i.id} className={`group relative h-full overflow-hidden border-border/60 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-xl ${stale ? "stale-alert" : ""}`} style={{ boxShadow: "var(--shadow-card)" }}>
                    <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />
                    <CardContent className="space-y-4 p-5">
                      {stale && (
                        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                          <AlertTriangle className="h-3.5 w-3.5 animate-pulse" />
                          No activity for {daysSince ?? "7+"} days — needs follow-up
                        </div>
                      )}
                      <div className="flex items-start justify-between gap-2">
                        <Link to="/outreach/$type/$id" params={{ type: typePath, id: i.id }} className="min-w-0 flex-1 hover:text-primary">
                          <h3 className="truncate font-display text-lg font-semibold leading-tight">{i.name}</h3>
                          <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                            {(i.city || i.state) && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{[i.city, i.state].filter(Boolean).join(", ")}</span>}
                            {i.website && <span className="flex items-center gap-1"><Globe className="h-3 w-3" />Website</span>}
                          </div>
                        </Link>
                        {stage && <Badge style={{ background: `${stage.color}20`, color: stage.color, borderColor: `${stage.color}40` }} variant="outline" className="shrink-0">{stage.name}</Badge>}
                        <div className="flex shrink-0 items-center">
                          <EditInstituteDialog institute={i} type={type} />
                          <DeleteInstituteButton institute={i} type={type} />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Pipeline progress</span><span className="font-medium">{pct}%</span></div>
                        <Progress value={pct} className="h-1.5" />
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Update status</p>
                        <Select value={i.current_stage_id ?? undefined} onValueChange={(v) => {
                          const s = stages.find((x) => x.id === v);
                          if (!s || v === i.current_stage_id) return;
                          setStageChange({ id: i.id, name: i.name, stageId: v, stageName: s.name });
                          setStageNote("");
                        }}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Set stage" /></SelectTrigger>
                          <SelectContent>
                            {stages.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.name}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                          <InstituteTimelineDialog
                            instituteId={i.id}
                            instituteName={i.name}
                            trigger={
                              <button className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10">
                                <Activity className="h-3 w-3" /> Timeline
                              </button>
                            }
                          />
                        <div className="flex flex-wrap items-center gap-1">
                          <MeetingDialog
                            defaultInstituteId={i.id}
                            defaultTitle={`Meeting with ${i.name}`}
                            trigger={<Button size="sm" variant="outline" className="h-7 px-2 text-xs"><CalendarPlus className="mr-1 h-3 w-3" /> Schedule</Button>}
                          />
                          <AddTaskPopover instituteId={i.id} instituteName={i.name} />
                          <Popover open={noteFor === i.id} onOpenChange={(o) => { if (!o) { setNoteFor(null); setNoteText(""); } }}>
                            <PopoverTrigger asChild>
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => { setNoteFor(i.id); setNoteText(""); }}>
                                <MessageSquarePlus className="mr-1 h-3 w-3" /> Note
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
                          <Link to="/outreach/$type/$id" params={{ type: typePath, id: i.id }} className="inline-flex h-7 items-center gap-0.5 rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground hover:bg-primary/90">
                            Open <ChevronRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <Dialog open={!!stageChange} onOpenChange={(o) => { if (!o) { setStageChange(null); setStageNote(""); } }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Move to "{stageChange?.stageName}"</DialogTitle>
              <DialogDescription>Add a note explaining this stage change for {stageChange?.name}. This will be saved to the timeline.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="stage-note">Note *</Label>
              <Textarea id="stage-note" rows={4} autoFocus value={stageNote} onChange={(e) => setStageNote(e.target.value)} placeholder="What changed? Next steps?" />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setStageChange(null); setStageNote(""); }}>Cancel</Button>
              <Button disabled={!stageNote.trim() || updateStage.isPending}
                onClick={() => stageChange && updateStage.mutate({ ...stageChange, note: stageNote })}>
                {updateStage.isPending ? "Saving…" : "Update stage"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AppShell>
    </RequireAuth>
  );
}
