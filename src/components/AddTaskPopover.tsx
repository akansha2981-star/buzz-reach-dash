import { ReactNode, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ListPlus, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export function AddTaskPopover({ instituteId, instituteName, trigger }: { instituteId: string; instituteName: string; trigger?: ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState("normal");
  const [pushCEO, setPushCEO] = useState(false);

  const m = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Title required");
      const { data: t, error } = await supabase.from("tasks").insert({
        institute_id: instituteId,
        title: title.trim(),
        description: desc.trim() || null,
        due_at: due ? new Date(due).toISOString() : null,
        created_by: user?.id ?? null,
      }).select("id").single();
      if (error) throw error;
      if (pushCEO && t) {
        const { error: e2 } = await supabase.from("ceo_desk_requests").insert({
          source_type: "task",
          source_id: t.id,
          institute_id: instituteId,
          title: title.trim(),
          message: desc.trim() || null,
          priority,
          request_type: "task",
          deadline_at: due ? new Date(due).toISOString() : null,
          requester_id: user?.id ?? null,
          requester_email: user?.email ?? null,
        });
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      toast.success(pushCEO ? "Task added & sent to CEO Desk" : "Task added");
      setTitle(""); setDesc(""); setDue(""); setPriority("normal"); setPushCEO(false);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["tasks", instituteId] });
      qc.invalidateQueries({ queryKey: ["tasks-all"] });
      qc.invalidateQueries({ queryKey: ["ceo-desk"] });
      qc.invalidateQueries({ queryKey: ["ceo-desk-badge"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline" className="h-8 min-w-0 flex-1 gap-1 px-2 text-xs sm:flex-none">
            <ListPlus className="h-3 w-3" /> Task
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-2">
          <p className="text-xs font-medium">New task for {instituteName}</p>
          <Input placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          <Textarea rows={2} placeholder="Notes (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Deadline</Label>
              <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Priority</Label>
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
          <Button size="sm" className="w-full" disabled={!title.trim() || m.isPending} onClick={() => m.mutate()}>
            {m.isPending ? "Saving…" : "Save task"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
