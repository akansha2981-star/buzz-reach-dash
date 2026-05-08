import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, BookOpen, Activity, CheckCircle2, Calendar, Sparkles, ListChecks, AlertTriangle, TrendingUp, Filter, X, Clock } from "lucide-react";
import { format, isAfter, isBefore, isToday, isPast, startOfDay, subDays, isWithinInterval } from "date-fns";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useRealtime } from "@/hooks/useRealtime";

export const Route = createFileRoute("/")({ component: () => <RequireAuth><AppShell title="Dashboard"><Dashboard /></AppShell></RequireAuth> });

type RangeKey = "7" | "30" | "90" | "all";
type TypeKey = "all" | "college" | "coaching";

function Dashboard() {
  useRealtime("institutes", [["dashboard"]]);
  useRealtime("outreach_activities", [["dashboard"]]);
  useRealtime("meetings", [["dashboard"]]);
  useRealtime("tasks", [["dashboard"]]);

  const [range, setRange] = useState<RangeKey>("30");
  const [typeFilter, setTypeFilter] = useState<TypeKey>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");

  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [insts, stages, activities, meetings, tasks] = await Promise.all([
        supabase.from("institutes").select("id, name, type, current_stage_id, created_at, updated_at, next_meeting_at"),
        supabase.from("outreach_stages").select("*").order("position"),
        supabase.from("outreach_activities").select("*, institutes(name, type)").order("created_at", { ascending: false }).limit(50),
        supabase.from("meetings").select("*, institutes(name, type)").order("meeting_at", { ascending: true }),
        supabase.from("tasks").select("*, institutes(id, name, type)").order("due_at", { ascending: true, nullsFirst: false }),
      ]);
      return {
        institutes: insts.data ?? [],
        stages: stages.data ?? [],
        activities: activities.data ?? [],
        meetings: meetings.data ?? [],
        tasks: tasks.data ?? [],
      };
    },
  });

  const cutoff = useMemo(() => {
    if (range === "all") return null;
    return startOfDay(subDays(new Date(), Number(range)));
  }, [range]);

  const filt = useMemo(() => {
    const insts = (data?.institutes ?? []).filter((i: any) => {
      if (typeFilter !== "all" && i.type !== typeFilter) return false;
      if (stageFilter === "none" && i.current_stage_id) return false;
      if (stageFilter !== "all" && stageFilter !== "none" && i.current_stage_id !== stageFilter) return false;
      if (cutoff && new Date(i.created_at) < cutoff) return false;
      return true;
    });
    const instIds = new Set(insts.map((i: any) => i.id));
    // For activities/meetings/tasks: respect type via linked institute, and respect date range
    const inType = (it: any) => typeFilter === "all" || it.institutes?.type === typeFilter || (it.institute?.type === typeFilter);
    const acts = (data?.activities ?? []).filter((a: any) => inType(a) && (!cutoff || new Date(a.created_at) >= cutoff));
    const meetings = (data?.meetings ?? []).filter((m: any) => inType(m) && (!cutoff || new Date(m.meeting_at) >= cutoff || new Date(m.meeting_at) >= new Date()));
    const tasks = (data?.tasks ?? []).filter((t: any) => inType(t) && (!cutoff || new Date(t.created_at) >= cutoff));
    return { insts, instIds, acts, meetings, tasks };
  }, [data, typeFilter, stageFilter, cutoff]);

  const stages = data?.stages ?? [];
  const closedStage = stages[stages.length - 1];
  const collegeCount = filt.insts.filter((i: any) => i.type === "college").length;
  const coachingCount = filt.insts.filter((i: any) => i.type === "coaching").length;
  const completed = filt.insts.filter((i: any) => i.current_stage_id === closedStage?.id).length;
  const ongoing = filt.insts.filter((i: any) => i.current_stage_id && i.current_stage_id !== closedStage?.id).length;
  const noStage = filt.insts.filter((i: any) => !i.current_stage_id).length;
  const conversion = filt.insts.length ? Math.round((completed / filt.insts.length) * 100) : 0;

  const now = new Date();
  const upcomingMeetings = filt.meetings.filter((m: any) => isAfter(new Date(m.meeting_at), now) && m.status === "scheduled");
  const todayMeetings = filt.meetings.filter((m: any) => isToday(new Date(m.meeting_at)) && m.status === "scheduled");

  const pendingTasks = filt.tasks.filter((t: any) => t.status === "pending");
  const overdueTasks = pendingTasks.filter((t: any) => t.due_at && isPast(new Date(t.due_at)) && !isToday(new Date(t.due_at)));
  const todayTasks = pendingTasks.filter((t: any) => t.due_at && isToday(new Date(t.due_at)));

  const stagePipeline = stages.map((s: any) => {
    const inStage = filt.insts.filter((i: any) => i.current_stage_id === s.id);
    const colleges = inStage.filter((i: any) => i.type === "college").length;
    const coaching = inStage.filter((i: any) => i.type === "coaching").length;
    return { ...s, count: inStage.length, colleges, coaching };
  });
  const maxStageCount = Math.max(1, ...stagePipeline.map((s: any) => s.count));
  const noStageColleges = filt.insts.filter((i: any) => !i.current_stage_id && i.type === "college").length;
  const noStageCoaching = filt.insts.filter((i: any) => !i.current_stage_id && i.type === "coaching").length;

  const recentlyAddedThisWeek = filt.insts.filter((i: any) => isWithinInterval(new Date(i.created_at), { start: subDays(new Date(), 7), end: new Date() })).length;

  const clear = () => { setRange("30"); setTypeFilter("all"); setStageFilter("all"); };
  const activeFilters = (range !== "30" ? 1 : 0) + (typeFilter !== "all" ? 1 : 0) + (stageFilter !== "all" ? 1 : 0);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-5 text-primary-foreground sm:p-6" style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-elegant)" }}>
        <div className="flex items-center gap-2 text-sm opacity-90"><Sparkles className="h-4 w-4" /> Welcome back</div>
        <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">Your outreach, organized.</h2>
        <p className="mt-1 max-w-xl text-sm opacity-90">Track every conversation with colleges and coaching institutes from first email to deal closed.</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><Filter className="h-4 w-4" /> Filters</div>
          <Select value={range} onValueChange={(v: RangeKey) => setRange(v)}>
            <SelectTrigger className="h-8 w-auto gap-1 px-3 text-xs sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(v: TypeKey) => setTypeFilter(v)}>
            <SelectTrigger className="h-8 w-auto gap-1 px-3 text-xs sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="college">Colleges</SelectItem>
              <SelectItem value="coaching">Coaching</SelectItem>
            </SelectContent>
          </Select>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="h-8 w-auto gap-1 px-3 text-xs sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              <SelectItem value="none">No stage set</SelectItem>
              {stages.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs" onClick={clear}><X className="h-3 w-3" /> Clear</Button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">Showing {filt.insts.length} institute{filt.insts.length === 1 ? "" : "s"}</span>
        </CardContent>
      </Card>

      {/* Summary stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={GraduationCap} label="Colleges" value={collegeCount} />
        <Stat icon={BookOpen} label="Coaching" value={coachingCount} />
        <Stat icon={Activity} label="Ongoing" value={ongoing} accent="bg-warning/15 text-warning" />
        <Stat icon={CheckCircle2} label="Completed" value={completed} accent="bg-success/15 text-success" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Calendar} label="Today's meetings" value={todayMeetings.length} accent="bg-primary/15 text-primary" />
        <Stat icon={Clock} label="Upcoming meetings" value={upcomingMeetings.length} accent="bg-blue-500/15 text-blue-600" />
        <Stat icon={ListChecks} label="Pending tasks" value={pendingTasks.length} accent="bg-indigo-500/15 text-indigo-600" />
        <Stat icon={AlertTriangle} label="Overdue tasks" value={overdueTasks.length} accent={overdueTasks.length > 0 ? "bg-destructive/15 text-destructive" : ""} />
      </div>

      {/* Pipeline + Conversion */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> Pipeline by stage</CardTitle>
            <CardDescription>How institutes are distributed across your outreach stages</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stagePipeline.length === 0 && <p className="text-sm text-muted-foreground">No stages configured.</p>}
            {stagePipeline.map((s: any) => (
              <div key={s.id} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 truncate"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />{s.name}</span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[10px]"><GraduationCap className="h-3 w-3" />{s.colleges}</Badge>
                    <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[10px]"><BookOpen className="h-3 w-3" />{s.coaching}</Badge>
                    <span className="ml-1 w-6 text-right font-semibold tabular-nums">{s.count}</span>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full transition-all" style={{ width: `${(s.count / maxStageCount) * 100}%`, background: s.color }} />
                </div>
              </div>
            ))}
            {noStage > 0 && (
              <div className="space-y-1 border-t pt-3">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">No stage set</span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[10px]"><GraduationCap className="h-3 w-3" />{noStageColleges}</Badge>
                    <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[10px]"><BookOpen className="h-3 w-3" />{noStageCoaching}</Badge>
                    <span className="ml-1 w-6 text-right font-semibold tabular-nums">{noStage}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Conversion</CardTitle><CardDescription>Completed deals in scope</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className="font-display text-5xl font-bold text-primary">{conversion}%</p>
              <p className="mt-1 text-xs text-muted-foreground">{completed} of {filt.insts.length} closed</p>
            </div>
            <Progress value={conversion} />
            <div className="grid grid-cols-2 gap-2 pt-2 text-center text-xs">
              <div className="rounded-lg border p-2"><p className="font-display text-lg font-bold">{recentlyAddedThisWeek}</p><p className="text-muted-foreground">New this week</p></div>
              <div className="rounded-lg border p-2"><p className="font-display text-lg font-bold">{filt.acts.length}</p><p className="text-muted-foreground">Activities</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lists */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> Upcoming Meetings</span>
              <Link to="/meetings" className="text-xs font-normal text-primary hover:underline">View all</Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcomingMeetings.length === 0 && <p className="text-sm text-muted-foreground">No upcoming meetings.</p>}
            {upcomingMeetings.slice(0, 5).map((m: any) => (
              <Link key={m.id} to="/meetings" className="block rounded-lg border p-2.5 transition-colors hover:bg-accent">
                <p className="truncate text-sm font-medium">{m.title}</p>
                <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="truncate">{m.institutes?.name ?? "—"}</span>
                  <span>{format(new Date(m.meeting_at), "MMM d, p")}</span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2"><ListChecks className="h-4 w-4 text-primary" /> Tasks due soon</span>
              <Link to="/tasks" className="text-xs font-normal text-primary hover:underline">View all</Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingTasks.length === 0 && <p className="text-sm text-muted-foreground">No pending tasks.</p>}
            {[...overdueTasks, ...todayTasks, ...pendingTasks.filter((t: any) => !overdueTasks.includes(t) && !todayTasks.includes(t))].slice(0, 5).map((t: any) => {
              const overdue = t.due_at && isPast(new Date(t.due_at)) && !isToday(new Date(t.due_at));
              const today = t.due_at && isToday(new Date(t.due_at));
              return (
                <Link key={t.id} to="/tasks" className={`block rounded-lg border p-2.5 transition-colors hover:bg-accent ${overdue ? "border-destructive/40 bg-destructive/5" : ""}`}>
                  <p className="truncate text-sm font-medium">{t.title}</p>
                  <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{t.institutes?.name ?? "—"}</span>
                    {t.due_at && (
                      <span className={overdue ? "text-destructive" : today ? "text-amber-600" : ""}>
                        {overdue ? "Overdue · " : today ? "Today · " : ""}{format(new Date(t.due_at), "MMM d, p")}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Recent Activity</span>
              <Link to="/outreach/timeline" className="text-xs font-normal text-primary hover:underline">View all</Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {filt.acts.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
            {filt.acts.slice(0, 5).map((a: any) => (
              <div key={a.id} className="flex items-start gap-2 rounded-lg border p-2.5">
                <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.institutes?.name}{a.stage_name_snapshot ? ` → ${a.stage_name_snapshot}` : ""}</p>
                  {a.note && <p className="truncate text-xs text-muted-foreground">{a.note}</p>}
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{format(new Date(a.created_at), "MMM d, p")}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number | string; accent?: string }) {
  return (
    <Card className="overflow-hidden border-border/60" style={{ boxShadow: "var(--shadow-card)" }}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent ?? "bg-accent text-accent-foreground"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="font-display text-2xl font-bold leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
