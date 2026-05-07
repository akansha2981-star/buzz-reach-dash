import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchStages, type InstituteType } from "@/lib/data";
import { toast } from "sonner";

export function CreateInstituteDialog({ type }: { type: InstituteType }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: stages = [] } = useQuery({ queryKey: ["stages"], queryFn: fetchStages });
  const [form, setForm] = useState({
    name: "", city: "", state: "", website: "", contact_person: "", contact_designation: "",
    notes: "", current_stage_id: "",
  });
  const [emails, setEmails] = useState<string[]>([""]);
  const [phones, setPhones] = useState<string[]>([""]);

  const create = useMutation({
    mutationFn: async () => {
      const { data: inst, error } = await supabase.from("institutes").insert({
        type, name: form.name, city: form.city || null, state: form.state || null,
        website: form.website || null, contact_person: form.contact_person || null,
        contact_designation: form.contact_designation || null, notes: form.notes || null,
        current_stage_id: form.current_stage_id || null, created_by: user?.id ?? null,
      }).select().single();
      if (error) throw error;
      const cleanEmails = emails.map((e) => e.trim()).filter(Boolean).map((email) => ({ institute_id: inst.id, email }));
      const cleanPhones = phones.map((p) => p.trim()).filter(Boolean).map((phone) => ({ institute_id: inst.id, phone }));
      if (cleanEmails.length) await supabase.from("institute_emails").insert(cleanEmails);
      if (cleanPhones.length) await supabase.from("institute_phones").insert(cleanPhones);
      if (form.current_stage_id) {
        const stage = stages.find((s) => s.id === form.current_stage_id);
        await supabase.from("outreach_activities").insert({
          institute_id: inst.id, stage_id: stage?.id, stage_name_snapshot: stage?.name,
          note: "Profile created", created_by: user?.id ?? null,
        });
      }
    },
    onSuccess: () => {
      toast.success(`${type === "college" ? "College" : "Coaching institute"} added`);
      qc.invalidateQueries({ queryKey: ["institutes", type] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      setForm({ name: "", city: "", state: "", website: "", contact_person: "", contact_designation: "", notes: "", current_stage_id: "" });
      setEmails([""]); setPhones([""]);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="mr-2 h-4 w-4" /> Add {type === "college" ? "College" : "Coaching"}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New {type === "college" ? "college" : "coaching institute"} profile</DialogTitle>
          <DialogDescription>Add contact details and an initial outreach stage.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); if (!form.name.trim()) return toast.error("Name is required"); create.mutate(); }} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label>Name *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>City</Label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div><Label>State</Label><Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Website</Label><Input type="url" placeholder="https://" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
            <div><Label>Contact person</Label><Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></div>
            <div><Label>Designation</Label><Input value={form.contact_designation} onChange={(e) => setForm({ ...form, contact_designation: e.target.value })} /></div>
          </div>

          <div className="space-y-2">
            <Label>Email addresses</Label>
            {emails.map((e, i) => (
              <div key={i} className="flex gap-2">
                <Input type="email" placeholder="name@domain.com" value={e} onChange={(ev) => setEmails(emails.map((v, j) => (j === i ? ev.target.value : v)))} />
                {emails.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => setEmails(emails.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setEmails([...emails, ""])}><Plus className="mr-1 h-3 w-3" /> Add email</Button>
          </div>

          <div className="space-y-2">
            <Label>Mobile numbers</Label>
            {phones.map((p, i) => (
              <div key={i} className="flex gap-2">
                <Input type="tel" placeholder="+91 …" value={p} onChange={(ev) => setPhones(phones.map((v, j) => (j === i ? ev.target.value : v)))} />
                {phones.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => setPhones(phones.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setPhones([...phones, ""])}><Plus className="mr-1 h-3 w-3" /> Add phone</Button>
          </div>

          <div>
            <Label>Initial outreach stage</Label>
            <Select value={form.current_stage_id} onValueChange={(v) => setForm({ ...form, current_stage_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select stage (optional)" /></SelectTrigger>
              <SelectContent>{stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div><Label>Notes</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>{create.isPending ? "Saving…" : "Create profile"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
