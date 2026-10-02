import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Repeat, Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useMyTasks, normalizeRecurrenceFreq, recurrenceInterval, type MeTask } from "@/lib/me";
import { TaskDialog } from "./TaskDialog";

export function ResetAllTasksButton() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: tasks = [] } = useMyTasks();
  const m = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("me_tasks").delete().eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("All tasks reset");
      qc.invalidateQueries({ queryKey: ["me-tasks"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 text-destructive hover:text-destructive" disabled={!tasks.length}>
          <RotateCcw className="mr-1 h-4 w-4" /> Reset all
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset all tasks?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes all {tasks.length} of your tasks (including recurring ones) so you can start fresh. This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => m.mutate()}>
            Delete everything
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function describe(rule: any) {
  const f = normalizeRecurrenceFreq(rule);
  if (!f) return "Custom";
  const n = recurrenceInterval(rule);
  const unit = { daily: "day", weekly: "week", monthly: "month", yearly: "year" }[f as string] ?? f;
  return n > 1 ? `Every ${n} ${unit}s` : `Every ${unit}`;
}

export function RecurringTasksManager() {
  const qc = useQueryClient();
  const { data: tasks = [] } = useMyTasks();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MeTask | null>(null);
  const [dlgOpen, setDlgOpen] = useState(false);

  // One entry per series: the latest occurrence of each root.
  const series = useMemo(() => {
    const map = new Map<string, MeTask>();
    for (const t of tasks) {
      if (!t.recurrence_rule) continue;
      const root = t.recurrence_parent_id ?? t.id;
      const cur = map.get(root);
      if (!cur || (t.created_at ?? "") > (cur.created_at ?? "")) map.set(root, t);
    }
    return [...map.entries()].map(([root, t]) => ({ root, t }));
  }, [tasks]);

  const del = useMutation({
    mutationFn: async (root: string) => {
      const { error } = await supabase.from("me_tasks").delete().or(`id.eq.${root},recurrence_parent_id.eq.${root}`);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Recurring task deleted"); qc.invalidateQueries({ queryKey: ["me-tasks"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <Button variant="outline" size="sm" className="h-9" onClick={() => setOpen(true)}>
        <Repeat className="mr-1 h-4 w-4" /> Recurring
        {series.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5">{series.length}</Badge>}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Recurring tasks</DialogTitle>
            <DialogDescription>Add, edit or delete all your repeating tasks in one place.</DialogDescription>
          </DialogHeader>
          <Button size="sm" className="w-full" onClick={() => { setEditing(null); setDlgOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Add recurring task
          </Button>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {series.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No recurring tasks yet.</p>}
            {series.map(({ root, t }) => (
              <div key={root} className="flex items-center gap-2 rounded-lg border bg-card p-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {describe(t.recurrence_rule)}{t.due_time ? ` · ${t.due_time.slice(0, 5)}` : ""}{t.category ? ` · ${t.category}` : ""}
                  </p>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(t); setDlgOpen(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { if (confirm(`Delete "${t.title}" and all its occurrences?`)) del.mutate(root); }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <TaskDialog open={dlgOpen} onOpenChange={setDlgOpen} task={editing} />
    </>
  );
}
