import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import {
  useHabitFields,
  useHabitLogsAdv,
  useUpsertLog,
  FIELD_TYPE_META,
  todayKey,
  yesterdayKey,
  type Habit,
} from "@/lib/habits";

export function CheckInDialog({
  open,
  onOpenChange,
  habit,
  logDate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  habit: Habit;
  logDate?: string;
}) {
  const date = logDate ?? todayKey();
  const { data: fields = [] } = useHabitFields(habit.id);
  const { data: logs = [] } = useHabitLogsAdv(habit.id, 30);
  const upsert = useUpsertLog();

  const [values, setValues] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState("");

  const existingLog = useMemo(() => logs.find((l) => l.log_date === date), [logs, date]);
  const yesterdayLog = useMemo(() => logs.find((l) => l.log_date === yesterdayKey()), [logs]);

  useEffect(() => {
    if (!open) return;
    if (existingLog) {
      setValues(existingLog.values ?? {});
      setNotes(existingLog.notes ?? "");
    } else {
      setValues({});
      setNotes("");
    }
  }, [open, existingLog?.id]);

  const useYesterday = () => {
    if (!yesterdayLog) return;
    setValues(yesterdayLog.values ?? {});
    if (yesterdayLog.notes) setNotes(yesterdayLog.notes);
  };

  const submit = async () => {
    await upsert.mutateAsync({
      habit_id: habit.id,
      log_date: date,
      done: true,
      values,
      notes: notes || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{habit.icon || "✨"}</span>
            <div>
              <div>{habit.title}</div>
              <div className="text-xs font-normal text-muted-foreground">Check-in for {date}</div>
            </div>
          </DialogTitle>
        </DialogHeader>

        {fields.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-6 text-center">
            <Sparkles className="mx-auto mb-2 h-6 w-6 text-primary" />
            <p className="text-sm">Mark this habit complete for today?</p>
          </div>
        ) : (
          <div className="space-y-3">
            {yesterdayLog && (
              <Button size="sm" variant="outline" onClick={useYesterday} className="w-full gap-1.5">
                <Copy className="h-3.5 w-3.5" /> Same as yesterday
              </Button>
            )}
            {fields.map((f) => (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-1"
              >
                <Label className="flex items-center justify-between text-xs">
                  <span>
                    {FIELD_TYPE_META[f.type].icon} {f.label}
                    {f.unit ? <span className="ml-1 text-muted-foreground">({f.unit})</span> : null}
                  </span>
                  {f.target_value != null && (
                    <span className="text-[10px] text-muted-foreground">Target: {f.target_value}{f.unit ? ` ${f.unit}` : ""}/{f.target_period}</span>
                  )}
                </Label>
                {f.type === "time" ? (
                  <Input
                    type="time"
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  />
                ) : (
                  <Input
                    type="number"
                    step={f.type === "decimal" || f.type === "weight" || f.type === "distance" || f.type === "water" ? "0.01" : "1"}
                    inputMode="decimal"
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value ? Number(e.target.value) : "" })}
                    placeholder={`Enter ${f.label.toLowerCase()}`}
                  />
                )}
              </motion.div>
            ))}
            <div>
              <Label className="mb-1 block text-xs">Notes</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={upsert.isPending}
            className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white hover:from-emerald-600"
          >
            {upsert.isPending ? "Saving…" : "Mark complete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
