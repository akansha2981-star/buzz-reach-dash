import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isAfter, isToday, isTomorrow, startOfDay, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO } from "date-fns";
import { Calendar as CalendarIcon, Plus, Video, Link2, Clock, Users as UsersIcon, Trash2, Pencil, ExternalLink, CheckCircle2, XCircle, AlarmClock, ChevronLeft, ChevronRight, LayoutGrid, List as ListIcon, CalendarDays } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { logAction, type Meeting } from "@/lib/access";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/useRealtime";

export const Route = createFileRoute("/meetings")({
  component: () => (
    <RequireAuth perm="can_meetings">
      <AppShell title="Meetings"><MeetingsPage /></AppShell>
    </RequireAuth>
  ),
});

const PLATFORMS = [
  { value: "google_meet", label: "Google Meet" },
  { value: "zoom", label: "Zoom" },
  { value: "teams", label: "Microsoft Teams" },
  { value: "in_person", label: "In Person" },
  { value: "phone", label: "Phone Call" },
  { value: "other", label: "Other" },
];

const STATUSES = [
  { value: "scheduled", label: "Scheduled", color: "bg-blue-500" },
  { value: "completed", label: "Completed", color: "bg-emerald-500" },
  { value: "cancelled", label: "Cancelled", color: "bg-rose-500" },
  { value: "rescheduled", label: "Rescheduled", color: "bg-amber-500" },
];

function MeetingsPage() {
  useRealtime("meetings", [["meetings"], ["dashboard"]]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: meetings = [] } = useQuery({
    queryKey: ["meetings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("meetings").select("*, institutes(name, type)").order("meeting_at", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const filtered = useMemo(() => meetings.filter((m) => {
    if (statusFilter !== "all" && m.status !== statusFilter) return false;
    if (search && !`${m.title} ${m.institutes?.name ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [meetings, statusFilter, search]);

  const now = new Date();
  const upcoming = filtered.filter((m) => isAfter(new Date(m.meeting_at), now) && m.status === "scheduled");
  const past = filtered.filter((m) => !isAfter(new Date(m.meeting_at), now) || m.status !== "scheduled");

  const todayCount = meetings.filter((m) => isToday(new Date(m.meeting_at)) && m.status === "scheduled").length;
  const tomorrowCount = meetings.filter((m) => isTomorrow(new Date(m.meeting_at)) && m.status === "scheduled").length;
  const completedCount = meetings.filter((m) => m.status === "completed").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-display text-2xl font-bold">Meetings</h2>
          <p className="text-sm text-muted-foreground">Schedule, track, and manage every outreach meeting.</p>
        </div>
        <MeetingDialog />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={CalendarIcon} label="Today" value={todayCount} accent="bg-primary/15 text-primary" />
        <StatCard icon={AlarmClock} label="Tomorrow" value={tomorrowCount} accent="bg-amber-500/15 text-amber-600" />
        <StatCard icon={Clock} label="Upcoming" value={upcoming.length} accent="bg-blue-500/15 text-blue-600" />
        <StatCard icon={CheckCircle2} label="Completed" value={completedCount} accent="bg-emerald-500/15 text-emerald-600" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input placeholder="Search meetings…" value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="calendar">
        <TabsList>
          <TabsTrigger value="calendar"><CalendarDays className="mr-1.5 h-4 w-4" /> Calendar</TabsTrigger>
          <TabsTrigger value="agenda"><LayoutGrid className="mr-1.5 h-4 w-4" /> Agenda</TabsTrigger>
          <TabsTrigger value="upcoming"><ListIcon className="mr-1.5 h-4 w-4" /> Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Past & Closed ({past.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="calendar" className="pt-4">
          <CalendarView meetings={filtered} />
        </TabsContent>
        <TabsContent value="agenda" className="pt-4">
          <AgendaView meetings={filtered} />
        </TabsContent>
        <TabsContent value="upcoming" className="space-y-3 pt-4">
          {upcoming.length === 0 ? <EmptyState text="No upcoming meetings. Schedule one to get started." /> : upcoming.map((m) => <MeetingCard key={m.id} m={m} />)}
        </TabsContent>
        <TabsContent value="past" className="space-y-3 pt-4">
          {past.length === 0 ? <EmptyState text="No past meetings yet." /> : past.map((m) => <MeetingCard key={m.id} m={m} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: any) {
  return (
    <Card><CardContent className="flex items-center gap-3 p-5">
      <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", accent)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="font-display text-xl font-bold">{value}</p>
      </div>
    </CardContent></Card>
  );
}

function CalendarView({ meetings }: { meetings: any[] }) {
  const [cursor, setCursor] = useState<Date>(startOfMonth(new Date()));
  const [selected, setSelected] = useState<Date>(new Date());

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const byDay = useMemo(() => {
    const map = new Map<string, any[]>();
    meetings.forEach((m) => {
      const key = format(new Date(m.meeting_at), "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(m);
      map.set(key, arr);
    });
    return map;
  }, [meetings]);

  const dayMeetings = (byDay.get(format(selected, "yyyy-MM-dd")) ?? [])
    .sort((a, b) => +new Date(a.meeting_at) - +new Date(b.meeting_at));

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="font-display text-xl">{format(cursor, "MMMM yyyy")}</CardTitle>
            <CardDescription>Click a day to see meetings</CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => { setCursor(startOfMonth(new Date())); setSelected(new Date()); }}>Today</Button>
            <Button variant="ghost" size="icon" onClick={() => setCursor(subMonths(cursor, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => setCursor(addMonths(cursor, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 border-b pb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => <div key={d}>{d}</div>)}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {days.map((d) => {
              const key = format(d, "yyyy-MM-dd");
              const items = byDay.get(key) ?? [];
              const inMonth = isSameMonth(d, cursor);
              const sel = isSameDay(d, selected);
              const today = isToday(d);
              return (
                <button key={key} onClick={() => setSelected(d)}
                  className={cn(
                    "group relative flex min-h-[76px] flex-col rounded-md border p-1.5 text-left transition-all hover:border-primary/40 hover:bg-accent/40",
                    !inMonth && "opacity-40",
                    sel && "border-primary bg-primary/5 ring-1 ring-primary/30",
                    today && !sel && "border-primary/40",
                  )}>
                  <span className={cn("text-xs font-medium", today && "inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground")}>
                    {format(d, "d")}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {items.slice(0, 2).map((m: any) => {
                      const status = STATUSES.find((s) => s.value === m.status) ?? STATUSES[0];
                      return (
                        <div key={m.id} className="flex items-center gap-1 truncate rounded bg-background/80 px-1 py-0.5 text-[10px] font-medium">
                          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", status.color)} />
                          <span className="truncate">{format(new Date(m.meeting_at), "HH:mm")} {m.title}</span>
                        </div>
                      );
                    })}
                    {items.length > 2 && <p className="px-1 text-[10px] text-muted-foreground">+{items.length - 2} more</p>}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            {STATUSES.map((s) => (
              <span key={s.value} className="inline-flex items-center gap-1.5"><span className={cn("h-2 w-2 rounded-full", s.color)} /> {s.label}</span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-lg">{format(selected, "EEEE, MMM d")}</CardTitle>
          <CardDescription>{dayMeetings.length} meeting{dayMeetings.length === 1 ? "" : "s"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {dayMeetings.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nothing scheduled.</p>
          ) : dayMeetings.map((m: any) => {
            const status = STATUSES.find((s) => s.value === m.status) ?? STATUSES[0];
            return (
              <div key={m.id} className="rounded-lg border p-3 transition-colors hover:bg-accent/40">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-muted-foreground">{format(new Date(m.meeting_at), "p")} · {m.duration_minutes}m</p>
                  <Badge variant="outline" className="gap-1 text-[10px]"><span className={cn("h-1.5 w-1.5 rounded-full", status.color)} />{status.label}</Badge>
                </div>
                <p className="mt-1 font-medium">{m.title}</p>
                {m.institutes && <p className="text-xs text-muted-foreground">{m.institutes.name}</p>}
                <div className="mt-2 flex items-center justify-between">
                  {m.meeting_link ? (
                    <a href={m.meeting_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                      <Link2 className="h-3 w-3" /> Join
                    </a>
                  ) : <span />}
                  <MeetingDialog meeting={m} trigger={<Button variant="ghost" size="sm" className="h-7 px-2 text-xs"><Pencil className="mr-1 h-3 w-3" /> Edit</Button>} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function AgendaView({ meetings }: { meetings: any[] }) {
  const groups = useMemo(() => {
    const sorted = [...meetings].sort((a, b) => +new Date(a.meeting_at) - +new Date(b.meeting_at));
    const map = new Map<string, any[]>();
    sorted.forEach((m) => {
      const key = format(new Date(m.meeting_at), "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(m);
      map.set(key, arr);
    });
    return Array.from(map.entries());
  }, [meetings]);

  if (groups.length === 0) return <EmptyState text="No meetings to show." />;

  return (
    <div className="space-y-4">
      {groups.map(([day, items]) => {
        const d = parseISO(day);
        const label = isToday(d) ? "Today" : isTomorrow(d) ? "Tomorrow" : format(d, "EEEE, MMM d");
        return (
          <div key={day}>
            <div className="mb-2 flex items-center gap-2">
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">{label}</h3>
              <span className="text-xs text-muted-foreground">· {format(d, "MMMM d, yyyy")}</span>
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map((m: any) => <MeetingCard key={m.id} m={m} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">{text}</CardContent></Card>;
}

function MeetingCard({ m }: { m: any }) {
  const qc = useQueryClient();
  const status = STATUSES.find((s) => s.value === m.status) ?? STATUSES[0];
  const date = new Date(m.meeting_at);
  const isPast = !isAfter(date, new Date());
  const platform = PLATFORMS.find((p) => p.value === m.platform)?.label ?? m.platform;

  const setStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("meetings").update({ status }).eq("id", m.id);
      if (error) throw error;
      await logAction({ action: "meeting.status_changed", entity_type: "meeting", entity_id: m.id, entity_label: m.title, details: { status } });
    },
    onSuccess: () => { toast.success("Status updated"); qc.invalidateQueries({ queryKey: ["meetings"] }); },
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("meetings").delete().eq("id", m.id);
      if (error) throw error;
      await logAction({ action: "meeting.deleted", entity_type: "meeting", entity_id: m.id, entity_label: m.title });
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["meetings"] }); },
  });

  const attendees: string[] = Array.isArray(m.attendees) ? m.attendees : [];

  return (
    <Card className={cn("overflow-hidden", isPast && "opacity-90")}>
      <CardContent className="p-0">
        <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr_auto]">
          <div className="flex flex-col items-center justify-center bg-muted/40 p-4 text-center sm:border-r">
            <p className="text-xs font-medium uppercase text-muted-foreground">{format(date, "MMM")}</p>
            <p className="font-display text-3xl font-bold leading-tight">{format(date, "d")}</p>
            <p className="text-xs text-muted-foreground">{format(date, "EEE")}</p>
            <p className="mt-1 text-sm font-semibold">{format(date, "p")}</p>
          </div>
          <div className="space-y-2 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-lg font-semibold">{m.title}</h3>
              <Badge variant="outline" className="gap-1"><span className={cn("h-2 w-2 rounded-full", status.color)} />{status.label}</Badge>
            </div>
            {m.institutes && (
              <Link to="/outreach/$type/$id" params={{ type: m.institutes.type === "college" ? "colleges" : "coaching", id: m.institute_id }} className="inline-flex items-center text-xs text-primary hover:underline">
                {m.institutes.name}
              </Link>
            )}
            {m.description && <p className="text-sm text-muted-foreground">{m.description}</p>}
            <div className="flex flex-wrap gap-3 pt-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Video className="h-3 w-3" /> {platform}</span>
              <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {m.duration_minutes} min</span>
              {attendees.length > 0 && <span className="inline-flex items-center gap-1"><UsersIcon className="h-3 w-3" /> {attendees.length} attendees</span>}
              {m.reminder_minutes > 0 && <span className="inline-flex items-center gap-1"><AlarmClock className="h-3 w-3" /> {m.reminder_minutes}m reminder</span>}
            </div>
            {m.meeting_link && (
              <a href={m.meeting_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                <Link2 className="h-3 w-3" /> Join meeting <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <div className="flex flex-row items-center justify-end gap-1 p-3 sm:flex-col sm:items-end">
            <MeetingDialog meeting={m} trigger={<Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>} />
            {m.status === "scheduled" && (
              <>
                <Button variant="ghost" size="icon" onClick={() => setStatus.mutate("completed")} title="Mark complete">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setStatus.mutate("cancelled")} title="Cancel">
                  <XCircle className="h-4 w-4 text-rose-600" />
                </Button>
              </>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Delete meeting?</AlertDialogTitle><AlertDialogDescription>{m.title}</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => remove.mutate()}>Delete</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function MeetingDialog({ meeting, trigger, defaultInstituteId, defaultTitle, defaultOpen }: { meeting?: any; trigger?: React.ReactNode; defaultInstituteId?: string; defaultTitle?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const { user } = useAuth();
  const qc = useQueryClient();
  const editing = !!meeting;

  const initialDate = meeting ? new Date(meeting.meeting_at) : addDays(startOfDay(new Date()), 1);
  const [date, setDate] = useState<Date>(initialDate);
  const [time, setTime] = useState(format(initialDate, "HH:mm"));
  const [form, setForm] = useState({
    title: meeting?.title ?? defaultTitle ?? "",
    description: meeting?.description ?? "",
    institute_id: meeting?.institute_id ?? defaultInstituteId ?? "none",
    duration_minutes: meeting?.duration_minutes ?? 30,
    platform: meeting?.platform ?? "google_meet",
    meeting_link: meeting?.meeting_link ?? "",
    reminder_minutes: meeting?.reminder_minutes ?? 15,
    status: meeting?.status ?? "scheduled",
  });
  const [attendeesText, setAttendeesText] = useState<string>(
    Array.isArray(meeting?.attendees) ? meeting.attendees.join(", ") : ""
  );

  const { data: institutes = [] } = useQuery({
    queryKey: ["institutes-all"],
    queryFn: async () => {
      const { data } = await supabase.from("institutes").select("id, name, type").order("name");
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Title is required");
      const [hh, mm] = time.split(":").map(Number);
      const dt = new Date(date); dt.setHours(hh ?? 9, mm ?? 0, 0, 0);
      const attendees = attendeesText.split(",").map((s) => s.trim()).filter(Boolean);
      const payload = {
        title: form.title,
        description: form.description || null,
        institute_id: form.institute_id === "none" ? null : form.institute_id,
        meeting_at: dt.toISOString(),
        duration_minutes: Number(form.duration_minutes) || 30,
        platform: form.platform,
        meeting_link: form.meeting_link || null,
        attendees,
        reminder_minutes: Number(form.reminder_minutes) || 0,
        status: form.status,
      };
      if (editing) {
        const { error } = await supabase.from("meetings").update(payload).eq("id", meeting.id);
        if (error) throw error;
        await logAction({ action: "meeting.updated", entity_type: "meeting", entity_id: meeting.id, entity_label: form.title });
      } else {
        const { data, error } = await supabase.from("meetings").insert({ ...payload, created_by: user?.id ?? null }).select().single();
        if (error) throw error;
        await logAction({ action: "meeting.created", entity_type: "meeting", entity_id: data.id, entity_label: form.title });
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Meeting updated" : "Meeting scheduled");
      qc.invalidateQueries({ queryKey: ["meetings"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button><Plus className="mr-2 h-4 w-4" /> Schedule meeting</Button>}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit meeting" : "Schedule new meeting"}</DialogTitle>
          <DialogDescription>Set the time, platform, and attendees.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
          <div><Label>Meeting title *</Label><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />{format(date, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
            <div><Label>Time *</Label><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
            <div>
              <Label>Platform</Label>
              <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Duration (min)</Label><Input type="number" min={5} value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} /></div>
          </div>
          <div><Label>Meeting link</Label><Input type="url" placeholder="https://meet.google.com/..." value={form.meeting_link} onChange={(e) => setForm({ ...form, meeting_link: e.target.value })} /></div>
          <div>
            <Label>Linked profile</Label>
            <Select value={form.institute_id} onValueChange={(v) => setForm({ ...form, institute_id: v })}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {institutes.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.name} ({i.type})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Attendees (comma-separated emails or names)</Label><Input value={attendeesText} onChange={(e) => setAttendeesText(e.target.value)} placeholder="alice@x.com, Bob" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label>Reminder (minutes before)</Label><Input type="number" min={0} value={form.reminder_minutes} onChange={(e) => setForm({ ...form, reminder_minutes: Number(e.target.value) })} /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : editing ? "Save changes" : "Schedule"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
