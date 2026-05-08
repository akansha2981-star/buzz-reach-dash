import { useState } from "react";
import { Crown, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

type Props = {
  trigger?: React.ReactNode;
  defaultInstituteId?: string | null;
  defaultTitle?: string;
};

const REQUEST_TYPES = [
  { value: "approval", label: "Approval" },
  { value: "task", label: "Task" },
  { value: "meeting", label: "Meeting" },
  { value: "budget", label: "Budget" },
  { value: "decision", label: "Decision" },
  { value: "general", label: "General" },
];

export function NewCEORequestDialog({ trigger, defaultInstituteId = null, defaultTitle = "" }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [reqType, setReqType] = useState("approval");
  const [priority, setPriority] = useState("normal");
  const [deadline, setDeadline] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user || !title.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("ceo_desk_requests").insert({
      source_type: "other",
      source_id: null,
      institute_id: defaultInstituteId,
      title: title.trim(),
      message: message.trim() || null,
      priority,
      request_type: reqType,
      deadline_at: deadline ? new Date(deadline).toISOString() : null,
      requester_id: user.id,
      requester_email: user.email ?? null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Request sent to CEO Desk");
    qc.invalidateQueries({ queryKey: ["ceo-desk"] });
    qc.invalidateQueries({ queryKey: ["ceo-desk-badge"] });
    setOpen(false);
    setTitle(""); setMessage(""); setDeadline(""); setPriority("normal"); setReqType("approval");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" /> New CEO Request
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Crown className="h-5 w-5 text-amber-600" /> New CEO Request</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Task / Request name *</Label>
            <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Approve outreach budget for IIT-D" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={reqType} onValueChange={setReqType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REQUEST_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
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
          <div>
            <Label>Deadline</Label>
            <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
          <div>
            <Label>Details / Notes</Label>
            <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Context, what you need from the CEO…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !title.trim()}>Send to CEO</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
