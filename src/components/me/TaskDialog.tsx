import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateTask, useUpdateTask, useDeleteTask, type MeTask, type MeTaskPriority, type RecurrenceFreq } from "@/lib/me";
import { Trash2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  task?: MeTask | null;
  defaultDate?: string;
};

export function TaskDialog({ open, onOpenChange, task, defaultDate }: Props) {
  const isEdit = !!task;
  const create = useCreateTask();
  const update = useUpdateTask();
  const del = useDeleteTask();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<MeTaskPriority>("medium");
  const [dueDate, setDueDate] = useState<string>("");
  const [dueTime, setDueTime] = useState<string>("");
  const [reminderAt, setReminderAt] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [tags, setTags] = useState<string>("");
  const [estimated, setEstimated] = useState<string>("");
  const [recurFreq, setRecurFreq] = useState<RecurrenceFreq | "none">("none");
  const [recurInterval, setRecurInterval] = useState<string>("1");

  useEffect(() => {
    if (open) {
      setTitle(task?.title ?? "");
      setDescription(task?.description ?? "");
      setPriority(task?.priority ?? "medium");
      setDueDate(task?.due_date ?? defaultDate ?? "");
      setDueTime(task?.due_time?.slice(0, 5) ?? "");
      setReminderAt(task?.reminder_at?.slice(0, 16) ?? "");
      setCategory(task?.category ?? "");
      setTags((task?.tags ?? []).join(", "));
      setEstimated(task?.estimated_minutes?.toString() ?? "");
      setRecurFreq((task?.recurrence_rule?.freq as any) ?? "none");
      setRecurInterval(task?.recurrence_rule?.interval?.toString() ?? "1");
    }
  }, [open, task, defaultDate]);

  const submit = async () => {
    if (!title.trim()) return;
    const payload: any = {
      title: title.trim(),
      description: description.trim() || null,
      priority,
      due_date: dueDate || null,
      due_time: dueTime || null,
      reminder_at: reminderAt ? new Date(reminderAt).toISOString() : null,
      category: category.trim() || null,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      estimated_minutes: estimated ? Number(estimated) : null,
      recurrence_rule: recurFreq !== "none" ? { freq: recurFreq, interval: Number(recurInterval) || 1 } : null,
    };
    if (isEdit) await update.mutateAsync({ id: task!.id, ...payload });
    else await create.mutateAsync(payload);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="t-title">Title</Label>
            <Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to be done?" autoFocus />
          </div>
          <div>
            <Label htmlFor="t-desc">Notes</Label>
            <Textarea id="t-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional details" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as MeTaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Category</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Work" />
            </div>
            <div>
              <Label>Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <Label>Due time</Label>
              <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>Reminder</Label>
              <Input type="datetime-local" value={reminderAt} onChange={(e) => setReminderAt(e.target.value)} />
            </div>
            <div>
              <Label>Tags</Label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="comma, separated" />
            </div>
            <div>
              <Label>Est. minutes</Label>
              <Input type="number" value={estimated} onChange={(e) => setEstimated(e.target.value)} />
            </div>
            <div>
              <Label>Repeat</Label>
              <Select value={recurFreq} onValueChange={(v) => setRecurFreq(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {recurFreq !== "none" && (
              <div>
                <Label>Every N</Label>
                <Input type="number" min={1} value={recurInterval} onChange={(e) => setRecurInterval(e.target.value)} />
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2">
          {isEdit && (
            <Button variant="ghost" className="mr-auto text-rose-600" onClick={async () => { await del.mutateAsync(task!.id); onOpenChange(false); }}>
              <Trash2 className="mr-1 h-4 w-4" /> Delete
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!title.trim() || create.isPending || update.isPending}>
            {isEdit ? "Save" : "Add task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
