import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Mail, Phone, Globe, MapPin, Calendar, Trash2, CalendarPlus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { MeetingDialog } from "@/routes/meetings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchInstitute, fetchStages, type InstituteType } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/outreach/$type/$id")({
  component: InstituteDetailPage,
});

function InstituteDetailPage() {
  const { type, id } = Route.useParams();
  const instType: InstituteType = type === "colleges" ? "college" : "coaching";
  const qc = useQueryClient();
  const { user } = useAuth();
  const [note, setNote] = useState("");
  const [meeting, setMeeting] = useState("");
  const [pendingStage, setPendingStage] = useState<{ id: string; name: string } | null>(null);
  const [stageNote, setStageNote] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["institute", id], queryFn: () => fetchInstitute(id) });
  const { data: stages = [] } = useQuery({ queryKey: ["stages"], queryFn: fetchStages });

  const updateStage = useMutation({
    mutationFn: async ({ stageId, noteText }: { stageId: string; noteText: string }) => {
      const stage = stages.find((s) => s.id === stageId);
      const { error } = await supabase.from("institutes").update({ current_stage_id: stageId, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      await supabase.from("outreach_activities").insert({
        institute_id: id, stage_id: stageId, stage_name_snapshot: stage?.name,
        note: `Stage → ${stage?.name}: ${noteText.trim()}`, created_by: user?.id ?? null,
      });
    },
    onSuccess: () => { toast.success("Stage updated"); setPendingStage(null); setStageNote(""); qc.invalidateQueries({ queryKey: ["institute", id] }); qc.invalidateQueries({ queryKey: ["institutes", instType] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const addNote = useMutation({
    mutationFn: async () => {
      if (!note.trim()) return;
      const { error } = await supabase.from("outreach_activities").insert({ institute_id: id, note: note.trim(), created_by: user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => { setNote(""); qc.invalidateQueries({ queryKey: ["institute", id] }); toast.success("Note added"); },
  });

  const setNextMeeting = useMutation({
    mutationFn: async () => {
      const iso = meeting ? new Date(meeting).toISOString() : null;
      const { error } = await supabase.from("institutes").update({ next_meeting_at: iso }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["institute", id] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.success("Meeting saved"); },
  });

  const deleteInstitute = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("institutes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); window.location.href = `/outreach/${type}`; },
  });

  return (
    <RequireAuth>
      <AppShell title={data?.institute?.name ?? "Profile"}>
        {isLoading || !data?.institute ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-6">
            <Link to="/outreach/$type" params={{ type }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="font-display text-2xl">{data.institute.name}</CardTitle>
                      <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
                        {(data.institute.city || data.institute.state) && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{[data.institute.city, data.institute.state].filter(Boolean).join(", ")}</span>}
                        {data.institute.website && <a href={data.institute.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline"><Globe className="h-4 w-4" />Website</a>}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete this profile?")) deleteInstitute.mutate(); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {data.institute.contact_person && (
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Contact person</p>
                      <p className="font-medium">{data.institute.contact_person}{data.institute.contact_designation ? ` · ${data.institute.contact_designation}` : ""}</p>
                    </div>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Emails</p>
                      {data.emails.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
                      {data.emails.map((e: any) => (
                        <a key={e.id} href={`mailto:${e.email}`} className="flex items-center gap-2 text-sm hover:text-primary"><Mail className="h-4 w-4" />{e.email}</a>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Phones</p>
                      {data.phones.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
                      {data.phones.map((p: any) => (
                        <a key={p.id} href={`tel:${p.phone}`} className="flex items-center gap-2 text-sm hover:text-primary"><Phone className="h-4 w-4" />{p.phone}</a>
                      ))}
                    </div>
                  </div>
                  {data.institute.notes && (
                    <div><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Notes</p><p className="text-sm">{data.institute.notes}</p></div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Outreach Stage</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <Select value={data.institute.current_stage_id ?? undefined} onValueChange={(v) => updateStage.mutate(v)}>
                    <SelectTrigger><SelectValue placeholder="Set stage" /></SelectTrigger>
                    <SelectContent>{stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                  {data.institute.current_stage_id && stages.length > 0 && (() => {
                    const idx = stages.findIndex((s) => s.id === data.institute!.current_stage_id) + 1;
                    const pct = Math.round((idx / stages.length) * 100);
                    return (<div><div className="mb-1 flex justify-between text-xs"><span className="text-muted-foreground">Pipeline progress</span><span className="font-medium">{pct}%</span></div><Progress value={pct} /></div>);
                  })()}
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Next meeting</p>
                    <Input type="datetime-local" defaultValue={data.institute.next_meeting_at ? new Date(data.institute.next_meeting_at).toISOString().slice(0,16) : ""} onChange={(e) => setMeeting(e.target.value)} />
                    <Button size="sm" variant="outline" className="w-full" onClick={() => setNextMeeting.mutate()}><Calendar className="mr-1 h-4 w-4" /> Save meeting</Button>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Add note</p>
                    <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Quick note about this conversation…" />
                    <Button size="sm" className="w-full" onClick={() => addNote.mutate()} disabled={!note.trim()}>Add to timeline</Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
              <CardContent>
                {data.activities.length === 0 ? <p className="text-sm text-muted-foreground">No activity yet.</p> : (
                  <ol className="relative space-y-4 border-l border-border pl-6">
                    {data.activities.map((a: any) => {
                      const stage = stages.find((s) => s.id === a.stage_id);
                      return (
                        <li key={a.id} className="relative">
                          <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full ring-4 ring-background" style={{ background: stage?.color ?? "var(--primary)" }} />
                          <div className="flex flex-wrap items-center gap-2">
                            {a.stage_name_snapshot && <Badge variant="secondary">{a.stage_name_snapshot}</Badge>}
                            <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                          </div>
                          {a.note && <p className="mt-1 text-sm">{a.note}</p>}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </AppShell>
    </RequireAuth>
  );
}
