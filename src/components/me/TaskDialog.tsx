import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateTask, useUpdateTask, useDeleteTask, type MeTask, type MeTaskPriority, type RecurrenceFreq } from "@/lib/me";
import { useMyCategories, iconFor, toneStyle } from "@/lib/me-categories";
import { CategoryManager } from "./CategoryManager";
import { Trash2, Sparkles, Flag, CalendarClock, Bell, Tag as TagIcon, Timer, Repeat, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const PRIORITY_META: Record<MeTaskPriority, { label: string; gradient: string; ring: string; icon: string }> = {
  low:    { label: "Low",    gradient: "from-slate-400 to-slate-500",   ring: "ring-slate-400/40",  icon: "◦" },
  medium: { label: "Medium", gradient: "from-sky-500 to-blue-500",      ring: "ring-sky-500/40",    icon: "◉" },
  high:   { label: "High",   gradient: "from-amber-500 to-orange-500",  ring: "ring-amber-500/40",  icon: "▲" },
  urgent: { label: "Urgent", gradient: "from-rose-500 to-red-600",      ring: "ring-rose-500/40",   icon: "⚡" },
};

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

  const { data: categories = [] } = useMyCategories();
  const activeCat = categories.find((c) => c.name === category) ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden p-0">
        {/* Header with gradient accent */}
        <div className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-primary/10 via-background to-background px-6 pt-6 pb-4">
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
          {activeCat && (
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-1 opacity-90 transition-all"
              style={{ backgroundColor: activeCat.color }}
            />
          )}
          <DialogHeader className="relative">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
              <Sparkles className="h-5 w-5 text-primary" />
              {isEdit ? "Edit task" : "Create a new task"}
            </DialogTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Organize with categories, priority, and reminders.
            </p>
          </DialogHeader>
        </div>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto px-6 py-5">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="t-title" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Title</Label>
            <Input
              id="t-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              autoFocus
              className="h-11 border-border/60 bg-background/60 text-base font-medium shadow-sm"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="t-desc" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</Label>
            <Textarea
              id="t-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional details…"
              className="resize-none border-border/60 bg-background/60 shadow-sm"
            />
          </div>

          {/* Category — advanced chip grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <TagIcon className="h-3.5 w-3.5" /> Category
              </Label>
              <div className="flex items-center gap-2">
                {activeCat && (
                  <button
                    type="button"
                    onClick={() => setCategory("")}
                    className="text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    Clear
                  </button>
                )}
                <CategoryManager
                  trigger={
                    <button type="button" className="text-[11px] font-medium text-primary underline-offset-2 hover:underline">
                      Manage
                    </button>
                  }
                />
              </div>
            </div>
            {categories.length === 0 ? (
              <p className="rounded-lg border border-dashed py-4 text-center text-xs text-muted-foreground">
                No categories yet — click <span className="font-medium text-primary">Manage</span> to add one.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                {categories.map((c) => {
                  const Icon = iconFor(c.icon);
                  const active = category === c.name;
                  return (
                    <motion.button
                      key={c.id}
                      type="button"
                      onClick={() => setCategory(active ? "" : c.name)}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.96 }}
                      className={cn(
                        "group relative flex items-center gap-1.5 overflow-hidden rounded-xl border px-2.5 py-2 text-left text-xs font-semibold transition-all",
                        active
                          ? "border-transparent text-white shadow-md ring-2 ring-offset-1 ring-offset-background"
                          : "border-border/70 bg-background/40 text-foreground hover:border-border hover:bg-muted/50"
                      )}
                      style={active ? { backgroundColor: c.color, boxShadow: `0 0 0 2px ${c.color}55` } : undefined}
                    >
                      {!active && (
                        <span
                          className="absolute left-0 top-0 h-full w-1"
                          style={{ backgroundColor: c.color }}
                          aria-hidden
                        />
                      )}
                      <Icon
                        className={cn("relative h-3.5 w-3.5 shrink-0")}
                        style={active ? undefined : { color: c.color }}
                      />
                      <span className="relative truncate">{c.name}</span>
                      {active && <Check className="relative ml-auto h-3.5 w-3.5" />}
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Priority — segmented control */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Flag className="h-3.5 w-3.5" /> Priority
            </Label>
            <div className="grid grid-cols-4 gap-1.5 rounded-xl border border-border/60 bg-muted/30 p-1">
              {(Object.keys(PRIORITY_META) as MeTaskPriority[]).map((p) => {
                const meta = PRIORITY_META[p];
                const active = priority === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={cn(
                      "relative overflow-hidden rounded-lg px-2 py-1.5 text-xs font-semibold transition-all",
                      active ? "text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="priority-active"
                        className={cn("absolute inset-0 bg-gradient-to-br", meta.gradient)}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    <span className="relative flex items-center justify-center gap-1">
                      <span aria-hidden>{meta.icon}</span> {meta.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Schedule row */}
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-border/60 bg-muted/20 p-3">
            <div className="col-span-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" /> Schedule
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Due date</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-9 bg-background/70" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Due time</Label>
              <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className="h-9 bg-background/70" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="flex items-center gap-1 text-[11px] text-muted-foreground"><Bell className="h-3 w-3" /> Reminder</Label>
              <Input type="datetime-local" value={reminderAt} onChange={(e) => setReminderAt(e.target.value)} className="h-9 bg-background/70" />
            </div>
          </div>

          {/* Meta row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><TagIcon className="h-3 w-3" /> Tags</Label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="comma, separated" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Timer className="h-3 w-3" /> Est. min</Label>
              <Input type="number" value={estimated} onChange={(e) => setEstimated(e.target.value)} placeholder="30" className="h-9" />
            </div>
          </div>

          {/* Repeat — own prominent row */}
          <div className="space-y-2 rounded-xl border border-border/60 bg-gradient-to-br from-primary/5 to-transparent p-3">
            <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Repeat className="h-3.5 w-3.5" /> Repeat this task
            </Label>
            <div className="grid grid-cols-5 gap-1.5">
              {(["none","daily","weekly","monthly","custom"] as const).map((f) => {
                const active = recurFreq === f;
                const labels: Record<string,string> = { none:"Off", daily:"Daily", weekly:"Weekly", monthly:"Monthly", custom:"Custom" };
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setRecurFreq(f as any)}
                    className={cn(
                      "rounded-lg border px-2 py-1.5 text-xs font-semibold transition-all",
                      active
                        ? "border-transparent bg-gradient-to-br from-primary to-primary/80 text-white shadow-sm"
                        : "border-border/70 bg-background/60 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {labels[f]}
                  </button>
                );
              })}
            </div>
            <AnimatePresence>
              {recurFreq !== "none" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 pt-1"
                >
                  <Label className="text-[11px] text-muted-foreground">Every</Label>
                  <Input type="number" min={1} value={recurInterval} onChange={(e) => setRecurInterval(e.target.value)} className="h-8 w-20" />
                  <span className="text-[11px] text-muted-foreground">
                    {recurFreq === "daily" && "day(s)"}
                    {recurFreq === "weekly" && "week(s)"}
                    {recurFreq === "monthly" && "month(s)"}
                    {recurFreq === "custom" && "day(s)"}
                  </span>
                  <span className="ml-auto text-[10px] text-muted-foreground">Auto-added to Today each cycle</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>

        <DialogFooter className="gap-2 border-t border-border/60 bg-muted/20 px-6 py-3">
          {isEdit && (
            <Button variant="ghost" className="mr-auto text-rose-600 hover:bg-rose-500/10 hover:text-rose-700" onClick={async () => { await del.mutateAsync(task!.id); onOpenChange(false); }}>
              <Trash2 className="mr-1 h-4 w-4" /> Delete
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={!title.trim() || create.isPending || update.isPending}
            className="bg-gradient-to-br from-primary to-primary/80 shadow-md hover:shadow-lg"
          >
            <Sparkles className="mr-1 h-4 w-4" />
            {isEdit ? "Save changes" : "Create task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
