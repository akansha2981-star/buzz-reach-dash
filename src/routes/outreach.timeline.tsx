import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Search, MessageSquarePlus, GraduationCap, BookOpen } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchStages } from "@/lib/data";
import { logAction } from "@/lib/access";
import { toast } from "sonner";

export const Route = createFileRoute("/outreach/timeline")({ component: TimelinePage });

type ActivityRow = {
  id: string; institute_id: string; stage_id: string | null;
  stage_name_snapshot: string | null; note: string | null;
  created_at: string; created_by: string | null;
};

async function fetchAllActivities() {
  const [{ data: acts, error: e1 }, { data: insts, error: e2 }] = await Promise.all([
    supabase.from("outreach_activities").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("institutes").select("id,name,type"),
  ]);
  if (e1) throw e1; if (e2) throw e2;
  const map = new Map((insts ?? []).map((i: any) => [i.id, i]));
  return (acts ?? []).map((a: any) => ({ ...a, institute: map.get(a.institute_id) }));
}

function TimelinePage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data = [], isLoading } = useQuery({ queryKey: ["activities-all"], queryFn: fetchAllActivities });
  const { data: stages = [] } = useQuery({ queryKey: ["stages"], queryFn: fetchStages });
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "college" | "coaching">("all");
  const [newNote, setNewNote] = useState<{ instituteId: string; text: string } | null>(null);

  const filtered = useMemo(() => data.filter((a: any) => {
    if (typeFilter !== "all" && a.institute?.type !== typeFilter) return false;
    if (!q.trim()) return true;
    const m = q.trim().toLowerCase();
    return [a.institute?.name, a.note, a.stage_name_snapshot].some((v) => v?.toLowerCase().includes(m));
  }), [data, q, typeFilter]);

  const addNote = useMutation({
    mutationFn: async ({ instituteId, text, name }: { instituteId: string; text: string; name?: string }) => {
      if (!text.trim()) return;
      const { error } = await supabase.from("outreach_activities").insert({
        institute_id: instituteId, note: text.trim(), created_by: user?.id ?? null,
      });
      if (error) throw error;
      await logAction({ action: "note.added", entity_type: "institute", entity_id: instituteId, entity_label: name });
    },
    onSuccess: () => {
      toast.success("Note added");
      setNewNote(null);
      qc.invalidateQueries({ queryKey: ["activities-all"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <RequireAuth>
      <AppShell title="Activity Timeline">
        <div className="space-y-6">
          <div>
            <h2 className="font-display text-2xl font-bold">Activity Timeline</h2>
            <p className="text-sm text-muted-foreground">Every note and stage update across all colleges and coaching institutes.</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search by institute, note, stage…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
              <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="college">Colleges</SelectItem>
                <SelectItem value="coaching">Coaching</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">No activity yet.</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-6">
                <ol className="relative space-y-5 border-l border-border pl-6">
                  {filtered.map((a: any) => {
                    const stage = stages.find((s) => s.id === a.stage_id);
                    const inst = a.institute;
                    const typePath = inst?.type === "college" ? "colleges" : "coaching";
                    return (
                      <li key={a.id} className="relative">
                        <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full ring-4 ring-background" style={{ background: stage?.color ?? "var(--primary)" }} />
                        <div className="flex flex-wrap items-center gap-2">
                          {inst ? (
                            <Link to="/outreach/$type/$id" params={{ type: typePath, id: inst.id }} className="inline-flex items-center gap-1 text-sm font-medium hover:text-primary">
                              {inst.type === "college" ? <GraduationCap className="h-3.5 w-3.5" /> : <BookOpen className="h-3.5 w-3.5" />}
                              {inst.name}
                            </Link>
                          ) : <span className="text-sm font-medium text-muted-foreground">Unknown</span>}
                          {a.stage_name_snapshot && <Badge variant="secondary">{a.stage_name_snapshot}</Badge>}
                          <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                          {inst && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button size="sm" variant="ghost" className="ml-auto h-7 px-2 text-xs"
                                  onClick={() => setNewNote({ instituteId: inst.id, text: "" })}>
                                  <MessageSquarePlus className="mr-1 h-3 w-3" /> Add note
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent align="end" className="w-80">
                                <div className="space-y-2">
                                  <p className="text-xs font-medium">Add note to {inst.name}</p>
                                  <Textarea rows={3} value={newNote?.instituteId === inst.id ? newNote.text : ""}
                                    onChange={(e) => setNewNote({ instituteId: inst.id, text: e.target.value })} />
                                  <Button size="sm" className="w-full"
                                    disabled={addNote.isPending || !(newNote?.instituteId === inst.id && newNote.text.trim())}
                                    onClick={() => addNote.mutate({ instituteId: inst.id, text: newNote!.text, name: inst.name })}>
                                    Save note
                                  </Button>
                                </div>
                              </PopoverContent>
                            </Popover>
                          )}
                        </div>
                        {a.note && <p className="mt-1 text-sm">{a.note}</p>}
                      </li>
                    );
                  })}
                </ol>
              </CardContent>
            </Card>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
