import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, Pencil, Check, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchStages, type Stage } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/settings/stages")({
  component: () => <RequireAuth perm="can_stages"><AppShell title="Outreach Stages"><StagesSettings /></AppShell></RequireAuth>,
});

function StagesSettings() {
  const qc = useQueryClient();
  const { data: stages = [] } = useQuery({ queryKey: ["stages"], queryFn: fetchStages });
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6366f1");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  const invalidate = () => { qc.invalidateQueries({ queryKey: ["stages"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); };

  const create = useMutation({
    mutationFn: async () => {
      if (!newName.trim()) throw new Error("Name required");
      const pos = (stages[stages.length - 1]?.position ?? 0) + 1;
      const { error } = await supabase.from("outreach_stages").insert({ name: newName.trim(), position: pos, color: newColor });
      if (error) throw error;
    },
    onSuccess: () => { setNewName(""); invalidate(); toast.success("Stage added"); },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async (s: Stage) => {
      const { error } = await supabase.from("outreach_stages").update({ name: s.name, color: s.color, position: s.position }).eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => { setEditing(null); invalidate(); toast.success("Saved"); },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("outreach_stages").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { invalidate(); toast.success("Removed"); },
  });

  const move = (s: Stage, dir: -1 | 1) => {
    const i = stages.findIndex((x) => x.id === s.id);
    const j = i + dir;
    if (j < 0 || j >= stages.length) return;
    const other = stages[j];
    Promise.all([
      supabase.from("outreach_stages").update({ position: other.position }).eq("id", s.id),
      supabase.from("outreach_stages").update({ position: s.position }).eq("id", other.id),
    ]).then(invalidate);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold">Outreach Stages</h2>
        <p className="text-sm text-muted-foreground">Customize the pipeline for both Colleges and Coaching. Reorder, rename, or recolor anytime.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Add new stage</CardTitle><CardDescription>Appears at the end of the pipeline.</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="flex flex-col gap-2 sm:flex-row">
            <Input placeholder="Stage name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Input type="color" className="w-20" value={newColor} onChange={(e) => setNewColor(e.target.value)} />
            <Button type="submit"><Plus className="mr-1 h-4 w-4" /> Add</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pipeline ({stages.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {stages.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 rounded-lg border p-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-primary-foreground" style={{ background: s.color }}>{i + 1}</span>
              {editing === s.id ? (
                <>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1" />
                  <Input type="color" className="w-16" value={editColor} onChange={(e) => setEditColor(e.target.value)} />
                  <Button size="icon" variant="ghost" onClick={() => update.mutate({ ...s, name: editName, color: editColor })}><Check className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button>
                </>
              ) : (
                <>
                  <span className="flex-1 font-medium">{s.name}</span>
                  <Button size="icon" variant="ghost" onClick={() => move(s, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => move(s, 1)} disabled={i === stages.length - 1}><ArrowDown className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(s.id); setEditName(s.name); setEditColor(s.color); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Delete "${s.name}"?`)) remove.mutate(s.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
