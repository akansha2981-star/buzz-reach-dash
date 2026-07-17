import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { fetchStages, type InstituteType } from "@/lib/data";
import { logAction } from "@/lib/access";
import { PRIORITY_OPTIONS, PRIORITY_META } from "@/lib/priority";
import { toast } from "sonner";

export function EditInstituteDialog({ institute, type }: { institute: any; type: InstituteType }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data: stages = [] } = useQuery({ queryKey: ["stages"], queryFn: fetchStages });
  const [form, setForm] = useState({
    name: institute.name ?? "",
    city: institute.city ?? "",
    state: institute.state ?? "",
    website: institute.website ?? "",
    contact_person: institute.contact_person ?? "",
    contact_designation: institute.contact_designation ?? "",
    notes: institute.notes ?? "",
    current_stage_id: institute.current_stage_id ?? "",
    priority: institute.priority ? String(institute.priority) : "",
    sort_order: institute.sort_order != null ? String(institute.sort_order) : "",
  });

  const upd = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("institutes").update({
        name: form.name,
        city: form.city || null,
        state: form.state || null,
        website: form.website || null,
        contact_person: form.contact_person || null,
        contact_designation: form.contact_designation || null,
        notes: form.notes || null,
        current_stage_id: form.current_stage_id || null,
        priority: form.priority ? Number(form.priority) : null,
        sort_order: form.sort_order ? Number(form.sort_order) : 0,
      }).eq("id", institute.id);
      if (error) throw error;
      await logAction({ action: "institute.updated", entity_type: "institute", entity_id: institute.id, entity_label: form.name });
    },
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["institutes", type] });
      qc.invalidateQueries({ queryKey: ["institute", institute.id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit {type === "college" ? "college" : "coaching institute"}</DialogTitle>
          <DialogDescription>Update profile details and outreach stage.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); if (!form.name.trim()) return toast.error("Name is required"); upd.mutate(); }} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label>Name *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div><Label>State</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Website</Label><Input type="url" placeholder="https://" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
            <div><Label>Contact person</Label><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
            <div><Label>Designation</Label><Input value={form.contact_designation} onChange={(e) => setForm({ ...form, contact_designation: e.target.value })} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Outreach stage</Label>
              <Select value={form.current_stage_id} onValueChange={(v) => setForm({ ...form, current_stage_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger>
                <SelectContent>{stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue placeholder="No priority" /></SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p} value={String(p)}>
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: PRIORITY_META[p].color }} />
                        {PRIORITY_META[p].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sort order</Label>
              <Input type="number" placeholder="0" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
            </div>
          </div>
          <div><Label>Notes</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={upd.isPending}>{upd.isPending ? "Saving…" : "Save changes"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteInstituteButton({ institute, type }: { institute: any; type: InstituteType }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: async () => {
      // best-effort cleanup of related rows (no FK cascade defined)
      await supabase.from("institute_emails").delete().eq("institute_id", institute.id);
      await supabase.from("institute_phones").delete().eq("institute_id", institute.id);
      await supabase.from("outreach_activities").delete().eq("institute_id", institute.id);
      await supabase.from("tasks").delete().eq("institute_id", institute.id);
      await supabase.from("meetings").delete().eq("institute_id", institute.id);
      const { error } = await supabase.from("institutes").delete().eq("id", institute.id);
      if (error) throw error;
      await logAction({ action: "institute.deleted", entity_type: "institute", entity_id: institute.id, entity_label: institute.name });
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["institutes", type] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-7 w-7" title="Delete"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {institute.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes this {type === "college" ? "college" : "coaching institute"} along with its activities, tasks and meetings. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => del.mutate()} disabled={del.isPending}>
            {del.isPending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
