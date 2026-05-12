import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Play, Pause, RotateCcw, Maximize2, Minimize2, Timer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MeShell } from "@/components/me/MeShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useFocusSessions } from "@/lib/me";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/me/focus")({
  component: FocusPage,
});

const PRESETS = [
  { type: "pomodoro" as const, label: "Pomodoro", mins: 25 },
  { type: "short_break" as const, label: "Short break", mins: 5 },
  { type: "long_break" as const, label: "Long break", mins: 15 },
  { type: "focus" as const, label: "Deep focus", mins: 50 },
];

function FocusPage() {
  const { user } = useAuth();
  const { data: history = [] } = useFocusSessions(7);
  const [type, setType] = useState<typeof PRESETS[number]["type"]>("pomodoro");
  const [secs, setSecs] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [focus, setFocus] = useState(false);

  useEffect(() => { setSecs((PRESETS.find((p) => p.type === type)?.mins ?? 25) * 60); setRunning(false); }, [type]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (running && secs === 0) {
      setRunning(false);
      const mins = PRESETS.find((p) => p.type === type)!.mins;
      supabase.from("me_focus_sessions").insert({
        user_id: user!.id, type, duration_minutes: mins, ended_at: new Date().toISOString(), completed: true,
      }).then(() => {});
      try { new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=").play().catch(() => {}); } catch {}
    }
  }, [secs, running, type, user]);

  const total = (PRESETS.find((p) => p.type === type)?.mins ?? 25) * 60;
  const pct = ((total - secs) / total) * 100;
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");

  const minsToday = history
    .filter((s: any) => s.started_at?.slice(0, 10) === format(new Date(), "yyyy-MM-dd"))
    .reduce((a: number, s: any) => a + (s.duration_minutes || 0), 0);

  return (
    <MeShell title="Focus" subtitle="Deep work, one timer at a time.">
      <div className={cn("grid gap-4 lg:grid-cols-3", focus && "fixed inset-0 z-50 grid-cols-1 bg-background p-8")}>
        <Card className={cn("lg:col-span-2 overflow-hidden border-primary/20", focus && "h-full flex items-center justify-center")}>
          <CardContent className="flex flex-col items-center gap-6 p-8">
            <div className="flex flex-wrap justify-center gap-2">
              {PRESETS.map((p) => (
                <Button key={p.type} size="sm" variant={type === p.type ? "default" : "outline"} onClick={() => setType(p.type)}>
                  {p.label} · {p.mins}m
                </Button>
              ))}
            </div>
            <div className="relative flex h-64 w-64 items-center justify-center">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="46" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" className="opacity-30" />
                <circle cx="50" cy="50" r="46" fill="none" stroke="url(#g)" strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={`${(pct / 100) * 289} 289`} className="transition-all duration-1000" />
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" />
                    <stop offset="100%" stopColor="hsl(var(--primary-glow, var(--primary)))" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="text-center">
                <p className="font-display text-6xl font-bold tabular-nums">{mm}:{ss}</p>
                <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">{type.replace("_", " ")}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="lg" onClick={() => setRunning((r) => !r)} className="gap-1">
                {running ? <><Pause className="h-4 w-4" /> Pause</> : <><Play className="h-4 w-4" /> Start</>}
              </Button>
              <Button size="lg" variant="outline" onClick={() => { setSecs(total); setRunning(false); }}><RotateCcw className="h-4 w-4" /></Button>
              <Button size="lg" variant="outline" onClick={() => setFocus((f) => !f)}>
                {focus ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        {!focus && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Timer className="h-4 w-4" /> Today</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl bg-gradient-to-br from-primary/10 to-primary-glow/10 p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Focus minutes</p>
                <p className="font-display text-3xl font-bold">{minsToday}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">Recent sessions</p>
                {history.slice(0, 6).map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between rounded-md border px-2 py-1 text-xs">
                    <span className="capitalize">{s.type.replace("_", " ")}</span>
                    <span className="text-muted-foreground">{s.duration_minutes}m · {format(parseISO(s.started_at), "MMM d, p")}</span>
                  </div>
                ))}
                {history.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">No sessions yet — start your first Pomodoro.</p>}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MeShell>
  );
}
