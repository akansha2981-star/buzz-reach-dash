import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, X, Bell, Calendar as CalIcon, Target, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  FIELD_TYPE_META,
  useHabitFields,
  useSaveHabit,
  type Habit,
  type HabitField,
  type HabitFieldType,
  type HabitFrequency,
} from "@/lib/habits";
import { useMyCategories } from "@/lib/me-categories";

const EMOJI = ["✨","💪","📚","🏃","🧘","💧","🥗","😴","🎯","🎨","🎧","🧠","☀️","🌙","🔥","💰","🚭","💊","🚴","🏋️"];

const WEEKDAYS = [
  { i: 0, l: "S" }, { i: 1, l: "M" }, { i: 2, l: "T" },
  { i: 3, l: "W" }, { i: 4, l: "T" }, { i: 5, l: "F" }, { i: 6, l: "S" },
];

interface FieldDraft extends Partial<HabitField> {
  _tmpId: string;
  _delete?: boolean;
}

export function HabitDialog({
  open,
  onOpenChange,
  habit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  habit?: Habit | null;
}) {
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("✨");
  const [category, setCategory] = useState<string>("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [frequency, setFrequency] = useState<HabitFrequency>("daily");
  const [customDays, setCustomDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [reminders, setReminders] = useState<string[]>([]);
  const [reminderDraft, setReminderDraft] = useState("");
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [notes, setNotes] = useState("");
  const [fields, setFields] = useState<FieldDraft[]>([]);

  const { data: cats = [] } = useMyCategories();
  const { data: existing = [] } = useHabitFields(habit?.id);
  const save = useSaveHabit();

  useEffect(() => {
    if (!open) return;
    if (habit) {
      setTitle(habit.title);
      setIcon(habit.icon || "✨");
      setCategory(habit.category ?? "");
      setStartDate(habit.start_date ?? new Date().toISOString().slice(0, 10));
      setFrequency(habit.frequency);
      setCustomDays(habit.custom_days ?? []);
      setReminders(habit.reminder_times ?? []);
      setNotes(habit.notes ?? "");
    } else {
      setTitle(""); setIcon("✨"); setCategory(""); setStartDate(new Date().toISOString().slice(0, 10));
      setFrequency("daily"); setCustomDays([1,2,3,4,5]); setReminders([]); setNotes(""); setFields([]);
    }
  }, [open, habit?.id]);

  useEffect(() => {
    setFields(existing.map((f) => ({ ...f, _tmpId: f.id })));
  }, [existing.length, habit?.id]);

  const addField = () => {
    const t: HabitFieldType = "number";
    setFields((f) => [...f, {
      _tmpId: crypto.randomUUID(),
      key: `field_${f.length + 1}`,
      label: "",
      type: t,
      unit: FIELD_TYPE_META[t].unit,
      target_value: null,
      target_period: "day",
      sort_order: f.length,
    }]);
  };

  const submit = async () => {
    if (!title.trim()) return;
    await save.mutateAsync({
      id: habit?.id,
      habit: {
        title: title.trim(),
        icon,
        category: category || null,
        start_date: startDate,
        frequency,
        custom_days: frequency === "custom" ? customDays : [],
        reminder_times: reminders,
        notes: notes || null,
        color: "hsl(var(--primary))",
      },
      fields: fields.map((f, i) => ({
        id: (existing.find((e) => e.id === f._tmpId)?.id) ?? undefined,
        key: (f.label || `field_${i}`).toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 32),
        label: f.label || "Field",
        type: f.type as HabitFieldType,
        unit: f.unit ?? null,
        target_value: f.target_value ?? null,
        target_period: f.target_period ?? "day",
        sort_order: i,
        _delete: f._delete,
      })),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {habit ? "Edit habit" : "New habit"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Name + emoji */}
          <div className="flex items-start gap-3">
            <div className="shrink-0">
              <Label className="mb-1 block text-xs">Icon</Label>
              <Select value={icon} onValueChange={setIcon}>
                <SelectTrigger className="w-16 text-2xl">{icon}</SelectTrigger>
                <SelectContent className="grid grid-cols-5 gap-1 p-2">
                  {EMOJI.map((e) => (
                    <SelectItem key={e} value={e} className="justify-center text-2xl">{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label className="mb-1 block text-xs">Habit name</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Morning Gym" />
            </div>
          </div>

          {/* Category + Start date */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-xs">Category</Label>
              <Select value={category || "none"} onValueChange={(v) => setCategory(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {cats.map((c: any) => (
                    <SelectItem key={c.id} value={c.name}>
                      <span className="mr-2">{c.icon || "🏷️"}</span>{c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs">Start date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
          </div>

          {/* Frequency */}
          <div>
            <Label className="mb-1 block text-xs flex items-center gap-1"><CalIcon className="h-3 w-3" /> Frequency</Label>
            <div className="flex gap-2">
              {(["daily","weekly","custom"] as HabitFrequency[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFrequency(f)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm capitalize transition-all",
                    frequency === f ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
                  )}
                >{f}</button>
              ))}
            </div>
            {frequency === "custom" && (
              <div className="mt-2 flex gap-1.5">
                {WEEKDAYS.map((d) => {
                  const active = customDays.includes(d.i);
                  return (
                    <button
                      key={d.i}
                      type="button"
                      onClick={() => setCustomDays((cd) => active ? cd.filter((x) => x !== d.i) : [...cd, d.i])}
                      className={cn(
                        "h-9 w-9 rounded-full border text-xs font-semibold transition-all",
                        active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"
                      )}
                    >{d.l}</button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reminders */}
          <div>
            <Label className="mb-1 block text-xs flex items-center gap-1"><Bell className="h-3 w-3" /> Reminder times</Label>
            <div className="flex flex-wrap gap-1.5">
              <AnimatePresence>
                {reminders.map((t) => (
                  <motion.span
                    key={t}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                  >
                    {t}
                    <button onClick={() => setReminders((r) => r.filter((x) => x !== t))}>
                      <X className="h-3 w-3" />
                    </button>
                  </motion.span>
                ))}
              </AnimatePresence>
              <div className="flex gap-1">
                <Input
                  type="time"
                  value={reminderDraft}
                  onChange={(e) => setReminderDraft(e.target.value)}
                  className="h-8 w-28 text-xs"
                />
                <Button size="sm" variant="outline" className="h-8"
                  onClick={() => {
                    if (reminderDraft && !reminders.includes(reminderDraft)) {
                      setReminders([...reminders, reminderDraft]);
                      setReminderDraft("");
                    }
                  }}
                ><Plus className="h-3 w-3" /></Button>
              </div>
            </div>
          </div>

          {/* Custom fields */}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
            <div className="mb-2 flex items-center justify-between">
              <Label className="flex items-center gap-1 text-xs"><Target className="h-3 w-3" /> Track additional values (optional)</Label>
              <Button size="sm" variant="outline" onClick={addField} className="h-7 gap-1 text-xs">
                <Plus className="h-3 w-3" /> Add field
              </Button>
            </div>
            <p className="mb-2 text-[11px] text-muted-foreground">
              e.g. Gym → Calories Burned, Weight, Duration. When you check-in, you'll enter these values.
            </p>
            <div className="space-y-2">
              {fields.filter((f) => !f._delete).length === 0 && (
                <p className="rounded-lg border border-dashed border-border/60 p-3 text-center text-xs text-muted-foreground">
                  No custom fields — completion-only tracking.
                </p>
              )}
              <AnimatePresence>
                {fields.map((f, idx) =>
                  f._delete ? null : (
                    <motion.div
                      key={f._tmpId}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      className="grid grid-cols-12 gap-2 rounded-lg border border-border/60 bg-background/50 p-2"
                    >
                      <Input
                        className="col-span-4 h-8 text-xs"
                        placeholder="Label (e.g. Calories)"
                        value={f.label || ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setFields((fs) => fs.map((x, i) => i === idx ? { ...x, label: v } : x));
                        }}
                      />
                      <Select
                        value={f.type as string}
                        onValueChange={(v) => {
                          const t = v as HabitFieldType;
                          setFields((fs) => fs.map((x, i) => i === idx ? { ...x, type: t, unit: FIELD_TYPE_META[t].unit } : x));
                        }}
                      >
                        <SelectTrigger className="col-span-3 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(FIELD_TYPE_META).map(([k, m]) => (
                            <SelectItem key={k} value={k}>{m.icon} {m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        className="col-span-2 h-8 text-xs"
                        placeholder="Unit"
                        value={f.unit ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setFields((fs) => fs.map((x, i) => i === idx ? { ...x, unit: v } : x));
                        }}
                      />
                      <Input
                        className="col-span-2 h-8 text-xs"
                        placeholder="Target"
                        type="number"
                        value={f.target_value ?? ""}
                        onChange={(e) => {
                          const v = e.target.value ? Number(e.target.value) : null;
                          setFields((fs) => fs.map((x, i) => i === idx ? { ...x, target_value: v } : x));
                        }}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="col-span-1 h-8 w-8 text-destructive"
                        onClick={() => setFields((fs) => fs.map((x, i) => i === idx ? { ...x, _delete: true } : x))}
                      ><Trash2 className="h-3.5 w-3.5" /></Button>
                    </motion.div>
                  )
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label className="mb-1 block text-xs">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!title.trim() || save.isPending}
            className="bg-gradient-to-br from-primary to-primary-glow"
          >
            {save.isPending ? "Saving…" : habit ? "Save changes" : "Create habit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
