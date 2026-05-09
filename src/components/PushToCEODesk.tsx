import { useState } from "react";
import { Crown } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

type Props = {
  sourceType: "task" | "meeting" | "other";
  sourceId?: string;
  instituteId?: string | null;
  title: string;
  variant?: "icon" | "button" | "ghost";
  className?: string;
};

export function PushToCEODesk({ sourceType, sourceId, instituteId, title, variant = "icon", className }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<string>("normal");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("ceo_desk_requests").insert({
      source_type: sourceType,
      source_id: sourceId ?? null,
      institute_id: instituteId ?? null,
      title,
      message: message.trim() || null,
      priority,
      requester_id: user.id,
      requester_email: user.email ?? null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Pushed to CEO Desk");
    qc.invalidateQueries({ queryKey: ["ceo-desk"] });
    qc.invalidateQueries({ queryKey: ["ceo-desk-badge"] });
    setOpen(false); setMessage(""); setPriority("normal");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "icon" ? (
          <Button variant="ghost" size="icon" title="Push to CEO Desk" className={className}>
            <Crown className="h-4 w-4 text-amber-600" />
          </Button>
        ) : variant === "ghost" ? (
          <Button variant="ghost" size="sm" className={className}>
            <Crown className="mr-1 h-3.5 w-3.5 text-amber-600" /> Push to CEO
          </Button>
        ) : (
          <Button size="sm" className={className}>
            <Crown className="mr-1 h-4 w-4" /> Push to CEO Desk
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Crown className="h-5 w-5 text-amber-600" /> Push to CEO Desk</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border bg-muted/30 p-2 text-sm"><span className="text-muted-foreground">Item:</span> {title}</div>
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
          <div>
            <Label>Message for CEO</Label>
            <Textarea rows={4} placeholder="Add context, what you need help / approval on…" value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>Send to CEO</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
