import { useState } from "react";
import { Plus, ListChecks, Crown } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { fetchInstitutes } from "@/lib/data";

type Props = {
  trigger?: React.ReactNode;
};

export function NewTaskDialog({ trigger }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [instituteId, setInstituteId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState("normal");
  const [pushCEO, setPushCEO] = useState(false);
  const [recurFreq, setRecurFreq] = useState<"none" | "daily" | "weekly" | "monthly" | "yearly">("none");
  const [recurInterval, setRecurInterval] = useState("1");
  const [busy, setBusy] = useState(false);

  const { data: colleges = [] } = useQuery({ queryKey: ["institutes", "college"], queryFn: () => fetchInstitutes("college") });
  const { data: coaching = [] } = useQuery({ queryKey: ["institutes", "coaching"], queryFn: () => fetchInstitutes("coaching") });

  const submit = async () => {
    if (!user || !title.trim() || !instituteId) return;
    setBusy(true);
    const { data: t, error } = await supabase.from("tasks").insert({
      institute_id: instituteId,
      title: title.trim(),
      description: description.trim() || null,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      created_by: user.id,
    }).select("id").single();

    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }

    if (pushCEO && t) {
      const { error: e2 } = await supabase.from("ceo_desk_requests").insert({
        source_type: "task",
        source_id: t.id,
        institute_id: instituteId,
        title: title.trim(),
        message: description.trim() || null,
        priority,
        request_type: "task",
        deadline_at: dueAt ? new Date(dueAt).toISOString() : null,
        requester_id: user.id,
        requester_email: user.email ?? null,
      });
      if (e2) {
        setBusy(false);
        return toast.error(e2.message);
      }
    }

    toast.success(pushCEO ? "Task created & sent to CEO Desk" : "Task created");
    qc.invalidateQueries({ queryKey: ["tasks-all"] });
    qc.invalidateQueries({ queryKey: ["ceo-desk"] });
    qc.invalidateQueries({ queryKey: ["ceo-desk-badge"] });
    setOpen(false);
    setInstituteId("");
    setTitle("");
    setDescription("");
    setDueAt("");
    setPriority("normal");
    setPushCEO(false);
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" /> New task
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ListChecks className="h-5 w-5 text-primary" /> New task</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Institute *</Label>
            <Select value={instituteId} onValueChange={setInstituteId}>
              <SelectTrigger>
                <SelectValue placeholder="Select college or coaching" />
              </SelectTrigger>
              <SelectContent>
                {colleges.length > 0 && (
                  <>
                    <SelectItem value="__colleges__" disabled className="text-xs font-semibold text-muted-foreground">Colleges</SelectItem>
                    {colleges.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                  </>
                )}
                {coaching.length > 0 && (
                  <>
                    <SelectItem value="__coaching__" disabled className="text-xs font-semibold text-muted-foreground">Coaching</SelectItem>
                    {coaching.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Task *</Label>
            <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to be done?" />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional details…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Due</Label>
              <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 rounded-md border bg-muted/30 p-2 text-xs">
            <Checkbox checked={pushCEO} onCheckedChange={(c) => setPushCEO(!!c)} />
            <Crown className="h-3.5 w-3.5 text-amber-600" />
            <span>Also push to CEO Desk</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !title.trim() || !instituteId}>Create task</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
