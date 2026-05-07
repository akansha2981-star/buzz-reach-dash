import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, BookOpen, Activity, CheckCircle2, Calendar, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({ component: () => <RequireAuth><AppShell title="Dashboard"><Dashboard /></AppShell></RequireAuth> });

function Stat({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number | string; accent?: string }) {
  return (
    <Card className="overflow-hidden border-border/60" style={{ boxShadow: "var(--shadow-card)" }}>
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${accent ?? "bg-accent text-accent-foreground"}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="font-display text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [colleges, coaching, stages, recent, meetings] = await Promise.all([
        supabase.from("institutes").select("id, current_stage_id", { count: "exact" }).eq("type", "college"),
        supabase.from("institutes").select("id, current_stage_id", { count: "exact" }).eq("type", "coaching"),
        supabase.from("outreach_stages").select("*").order("position"),
        supabase.from("outreach_activities").select("*, institutes(name, type)").order("created_at", { ascending: false }).limit(8),
        supabase.from("institutes").select("id, name, type, next_meeting_at").not("next_meeting_at", "is", null).gte("next_meeting_at", new Date().toISOString()).order("next_meeting_at").limit(5),
      ]);
      const allInst = [...(colleges.data ?? []), ...(coaching.data ?? [])];
      const stagesArr = stages.data ?? [];
      const closedStage = stagesArr[stagesArr.length - 1];
      const completed = allInst.filter((i) => i.current_stage_id === closedStage?.id).length;
      const ongoing = allInst.filter((i) => i.current_stage_id && i.current_stage_id !== closedStage?.id).length;
      return {
        collegeCount: colleges.count ?? 0,
        coachingCount: coaching.count ?? 0,
        ongoing, completed,
        meetings: meetings.data ?? [],
        recent: recent.data ?? [],
      };
    },
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6 text-primary-foreground" style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-elegant)" }}>
        <div className="flex items-center gap-2 text-sm opacity-90"><Sparkles className="h-4 w-4" /> Welcome back</div>
        <h2 className="mt-2 font-display text-3xl font-bold">Your outreach, organized.</h2>
        <p className="mt-1 max-w-xl text-sm opacity-90">Track every conversation with colleges and coaching institutes from first email to deal closed.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={GraduationCap} label="Colleges" value={data?.collegeCount ?? 0} />
        <Stat icon={BookOpen} label="Coaching" value={data?.coachingCount ?? 0} />
        <Stat icon={Activity} label="Ongoing" value={data?.ongoing ?? 0} accent="bg-warning/15 text-warning" />
        <Stat icon={CheckCircle2} label="Completed" value={data?.completed ?? 0} accent="bg-success/15 text-success" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5 text-primary" /> Upcoming Meetings</CardTitle>
            <CardDescription>Scheduled outreach meetings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.meetings.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">No upcoming meetings.</p>}
            {data?.meetings.map((m: any) => (
              <Link key={m.id} to="/outreach/$type/$id" params={{ type: m.type === "college" ? "colleges" : "coaching", id: m.id }} className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent">
                <div>
                  <p className="font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{m.type}</p>
                </div>
                <Badge variant="secondary">{new Date(m.next_meeting_at).toLocaleString()}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> Recent Activity</CardTitle>
            <CardDescription>Latest stage updates and notes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.recent.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
            {data?.recent.map((a: any) => (
              <div key={a.id} className="flex items-start gap-3 rounded-lg border p-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{a.institutes?.name}{a.stage_name_snapshot ? ` → ${a.stage_name_snapshot}` : ""}</p>
                  {a.note && <p className="text-xs text-muted-foreground">{a.note}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
