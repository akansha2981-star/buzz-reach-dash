import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, isAfter, isToday, isTomorrow, startOfDay, addDays } from "date-fns";
import { Calendar as CalendarIcon, Plus, Video, Link2, Clock, Users as UsersIcon, Trash2, Pencil, ExternalLink, CheckCircle2, XCircle, AlarmClock } from "lucide-react";
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

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Past & Closed ({past.length})</TabsTrigger>
        </TabsList>
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

function MeetingDialog({ meeting, trigger }: { meeting?: any; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const qc = useQueryClient();
  const editing = !!meeting;

  const initialDate = meeting ? new Date(meeting.meeting_at) : addDays(startOfDay(new Date()), 1);
  const [date, setDate] = useState<Date>(initialDate);
  const [time, setTime] = useState(format(initialDate, "HH:mm"));
  const [form, setForm] = useState({
    title: meeting?.title ?? "",
    description: meeting?.description ?? "",
    institute_id: meeting?.institute_id ?? "none",
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
