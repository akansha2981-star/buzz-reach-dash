import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layers, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { fetchStages } from "@/lib/data";
import { toast } from "sonner";

/** Adds a pipeline stage at a chosen position; stages at/after it shift down by one. */
export function AddStageDialog() {
  const qc = useQueryClient();
  const { data: stages = [] } = useQuery({ queryKey: ["stages"], queryFn: fetchStages });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#0ea5e9");
  const [pos, setPos] = useState<string>("");
  const position = Number(pos || stages.length + 1);

  const create = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Stage name required");
      const sorted = [...stages].sort((a, b) => a.position - b.position);
      // Renumber cleanly: stages from the chosen slot onward move one step down.
      const updates = sorted.map((s, i) => ({ s, p: i + 1 >= position ? i + 2 : i + 1 })).filter(({ s, p }) => s.position !== p);
      for (const { s, p } of updates.reverse()) {
        const { error } = await supabase.from("outreach_stages").update({ position: p }).eq("id", s.id);
        if (error) throw error;
      }
      const { error } = await supabase.from("outreach_stages").insert({ name: name.trim(), color, position });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stages"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(`Stage added at position ${position}`);
      setOpen(false); setName(""); setPos("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Layers className="mr-1 h-4 w-4" /> Add stage</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add stage</DialogTitle></DialogHeader>
        <form id="add-stage" className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <div className="space-y-1.5"><Label>Stage name</Label><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Third Email Sent" /></div>
          <div className="space-y-1.5"><Label>Color</Label><Input type="color" className="h-10 w-24" value={color} onChange={(e) => setColor(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Position</Label>
            <Select value={String(position)} onValueChange={setPos}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: stages.length + 1 }, (_, i) => i + 1).map((p) => {
                  const cur = [...stages].sort((a, b) => a.position - b.position)[p - 1];
                  return <SelectItem key={p} value={String(p)}>{p}{cur ? ` — before "${cur.name}"` : " — at the end"}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
        </form>
        <DialogFooter><Button type="submit" form="add-stage" disabled={create.isPending}><Plus className="mr-1 h-4 w-4" /> Add stage</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
