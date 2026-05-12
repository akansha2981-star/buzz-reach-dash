import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Flame, Target, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MeShell } from "@/components/me/MeShell";
import { supabase } from "@/integrations/supabase/client";
import { useHabits, useHabitLogs, useBadges } from "@/lib/me";
import { useAuth } from "@/lib/auth";
import { addDays, format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/me/habits")({
  component: HabitsPage,
});

function HabitsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: habits = [] } = useHabits();
  const { data: logs = [] } = useHabitLogs(14);
  const { data: badges = [] } = useBadges();
  const [newTitle, setNewTitle] = useState("");

  const days = Array.from({ length: 14 }, (_, i) => addDays(new Date(), -13 + i));
  const isLogged = (habitId: string, day: Date) =>
    logs.some((l: any) => l.habit_id === habitId && l.log_date === format(day, "yyyy-MM-dd"));

  const add = useMutation({
    mutationFn: async () => {
      if (!newTitle.trim()) return;
      await supabase.from("me_habits").insert({ user_id: user!.id, title: newTitle.trim() });
    },
    onSuccess: () => { setNewTitle(""); qc.invalidateQueries({ queryKey: ["me-habits", user?.id] }); toast.success("Habit added"); },
  });

  const toggle = useMutation({
    mutationFn: async ({ habitId, date }: { habitId: string; date: string }) => {
      const existing = logs.find((l: any) => l.habit_id === habitId && l.log_date === date);
      if (existing) {
        await supabase.from("me_habit_logs").delete().eq("id", (existing as any).id);
      } else {
        await supabase.from("me_habit_logs").insert({ user_id: user!.id, habit_id: habitId, log_date: date, done: true });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me-habit-logs", user?.id] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { await supabase.from("me_habits").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me-habits", user?.id] }),
  });

  const streakOf = (habitId: string) => {
    let s = 0;
    for (let i = 0; i < 365; i++) {
      const d = format(addDays(new Date(), -i), "yyyy-MM-dd");
      const has = logs.some((l: any) => l.habit_id === habitId && l.log_date === d);
      if (has) s++;
      else if (i > 0) break;
    }
    return s;
  };

  return (
    <MeShell title="Habits & Goals" subtitle="Build streaks. Earn badges. Compound.">
      <Card>
        <CardContent className="flex gap-2 p-3">
          <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Add a new habit (e.g. Read 10 pages)" onKeyDown={(e) => e.key === "Enter" && add.mutate()} />
          <Button onClick={() => add.mutate()} disabled={!newTitle.trim()}><Plus className="h-4 w-4" /> Add</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Target className="h-4 w-4 text-primary" /> Habit Tracker · last 14 days</CardTitle></CardHeader>
        <CardContent>
          {habits.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No habits yet. Add one above to start tracking.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr><th className="py-1.5 text-left">Habit</th>
                    {days.map((d) => <th key={d.toISOString()} className="px-1 text-center text-[10px] text-muted-foreground">{format(d, "d")}</th>)}
                    <th className="px-2 text-right">Streak</th><th></th></tr>
                </thead>
                <tbody>
                  {habits.map((h: any) => (
                    <tr key={h.id} className="border-t">
                      <td className="py-2 pr-2 text-sm font-medium">{h.title}</td>
                      {days.map((d) => {
                        const date = format(d, "yyyy-MM-dd");
                        const on = isLogged(h.id, d);
                        return (
                          <td key={date} className="px-0.5 py-1 text-center">
                            <button
                              onClick={() => toggle.mutate({ habitId: h.id, date })}
                              className={cn("h-6 w-6 rounded-md border transition-all hover:scale-110",
                                on ? "border-emerald-500/40 bg-gradient-to-br from-emerald-500 to-emerald-600 shadow" : "border-muted bg-muted/40")}
                              title={date}
                            />
                          </td>
                        );
                      })}
                      <td className="px-2 text-right">
                        <span className="inline-flex items-center gap-0.5 font-semibold"><Flame className="h-3 w-3 text-amber-500" /> {streakOf(h.id)}</span>
                      </td>
                      <td><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove.mutate(h.id)}><Trash2 className="h-3 w-3" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Achievements</CardTitle></CardHeader>
        <CardContent>
          {badges.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">No badges yet — complete tasks and build streaks to earn them.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {badges.map((b: any) => (
                <div key={b.id} className="rounded-xl border bg-gradient-to-br from-amber-500/10 to-rose-500/10 px-3 py-2 text-xs font-semibold">
                  🏆 {b.code}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </MeShell>
  );
}
