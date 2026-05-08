import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, isAfter, isToday } from "date-fns";
import { Calendar, Clock, Pencil, Trash2, Video, Link2, ExternalLink, CalendarPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MeetingDialog } from "@/routes/meetings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/useRealtime";

const STATUS_COLOR: Record<string, string> = {
  scheduled: "bg-blue-500", completed: "bg-emerald-500", cancelled: "bg-rose-500", rescheduled: "bg-amber-500",
};

export function InstituteMeetingsSection({ instituteId, instituteName }: { instituteId: string; instituteName: string }) {
  useRealtime("meetings", [["meetings-inst", instituteId]]);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState<"all" | "upcoming" | "past" | "today">("all");

  const { data: meetings = [] } = useQuery({
    queryKey: ["meetings-inst", instituteId],
    queryFn: async () => {
      const { data, error } = await supabase.from("meetings").select("*").eq("institute_id", instituteId).order("meeting_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => meetings.filter((m: any) => {
    if (statusFilter !== "all" && m.status !== statusFilter) return false;
    const d = new Date(m.meeting_at);
    if (timeFilter === "upcoming" && !isAfter(d, new Date())) return false;
    if (timeFilter === "past" && isAfter(d, new Date())) return false;
    if (timeFilter === "today" && !isToday(d)) return false;
    if (search && !`${m.title} ${m.description ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [meetings, statusFilter, timeFilter, search]);

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("meetings").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["meetings-inst", instituteId] }); qc.invalidateQueries({ queryKey: ["meetings"] }); },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Meetings <span className="ml-2 text-xs font-normal text-muted-foreground">{filtered.length} of {meetings.length}</span></CardTitle>
        <MeetingDialog defaultInstituteId={instituteId} defaultTitle={`Meeting with ${instituteName}`}
          trigger={<Button size="sm" variant="outline"><CalendarPlus className="mr-1 h-4 w-4" /> Schedule</Button>} />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input placeholder="Search meetings…" value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1" />
          <Select value={timeFilter} onValueChange={(v: any) => setTimeFilter(v)}>
            <SelectTrigger className="sm:w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="past">Past</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="sm:w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="rescheduled">Rescheduled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No meetings.</p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((m: any) => (
              <li key={m.id} className="group flex items-start gap-3 rounded-lg border p-3">
                <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${STATUS_COLOR[m.status] ?? "bg-muted"}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{m.title}</p>
                    <Badge variant="outline" className="text-[10px]">{m.status}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{m.platform?.replace("_", " ")}</Badge>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(m.meeting_at), "MMM d, yyyy · h:mm a")} · <Clock className="h-3 w-3" /> {m.duration_minutes}m
                  </p>
                  {m.description && <p className="mt-1 text-xs text-muted-foreground">{m.description}</p>}
                  {m.meeting_link && (
                    <a href={m.meeting_link} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <Link2 className="h-3 w-3" /> Join <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100">
                  <MeetingDialog meeting={m} trigger={<Button size="icon" variant="ghost" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>} />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { if (confirm("Delete meeting?")) del.mutate(m.id); }}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
