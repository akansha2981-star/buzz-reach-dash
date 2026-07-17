import { ReactNode, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  MapPin,
  Globe,
  MessageSquarePlus,
  Activity,
  ChevronRight,
  CalendarPlus,
  X,
  AlertTriangle,
  LayoutGrid,
  List,
  Table as TableIcon,
  Upload,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { CreateInstituteDialog } from "@/components/CreateInstituteDialog";
import { BulkAddInstituteDialog, BulkDeleteInstituteDialog } from "@/components/BulkInstituteActions";
import { MeetingDialog } from "@/routes/meetings";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  fetchInstitutes,
  fetchStages,
  type Institute,
  type InstituteType,
  type Stage,
} from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { logAction } from "@/lib/access";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/useRealtime";
import { InstituteTimelineDialog } from "@/components/InstituteTimelineDialog";
import { AddTaskPopover } from "@/components/AddTaskPopover";
import { EditInstituteDialog, DeleteInstituteButton } from "@/components/EditInstituteDialog";
import { QuickDocUploadPopover } from "@/components/QuickDocUploadPopover";

type ViewMode = "grid" | "list" | "table" | "compact";
type InstituteWithMeta = Institute & {
  stage?: Stage;
  pct: number;
  typePath: "colleges" | "coaching";
  stale: boolean;
  daysSince: number | null;
  accent: string;
};

export function InstituteListPage({
  type,
  title,
  subtitle,
}: {
  type: InstituteType;
  title: string;
  subtitle: string;
}) {
  useRealtime("institutes", [["institutes", type], ["dashboard"]]);
  useRealtime("outreach_activities", [
    ["activities-all"],
    ["institute"],
    ["last-activity-map", type],
  ]);
  useRealtime("outreach_stages", [["stages"]]);
  const { data: list = [] } = useQuery({
    queryKey: ["institutes", type],
    queryFn: () => fetchInstitutes(type),
  });
  const { data: stages = [] } = useQuery({ queryKey: ["stages"], queryFn: fetchStages });
  const { data: lastActivityMap = {} } = useQuery({
    queryKey: ["last-activity-map", type],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outreach_activities")
        .select("institute_id, created_at")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data ?? []).forEach((a: any) => {
        if (!map[a.institute_id]) map[a.institute_id] = a.created_at;
      });
      return map;
    },
  });

  const [q, setQ] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"recent" | "name" | "stage" | "meeting">("recent");
  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "grid";
    return (localStorage.getItem(`institute-view:${type}`) as ViewMode) || "grid";
  });
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [stageChange, setStageChange] = useState<{
    id: string;
    name: string;
    stageId: string;
    stageName: string;
  } | null>(null);
  const [stageNote, setStageNote] = useState("");

  const qc = useQueryClient();
  const { user } = useAuth();

  const setViewPersist = (v: ViewMode) => {
    setView(v);
    if (typeof window !== "undefined") localStorage.setItem(`institute-view:${type}`, v);
  };

  const addNote = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      if (!noteText.trim()) return;
      const { error } = await supabase.from("outreach_activities").insert({
        institute_id: id,
        note: noteText.trim(),
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      await logAction({
        action: "note.added",
        entity_type: "institute",
        entity_id: id,
        entity_label: name,
      });
    },
    onSuccess: () => {
      toast.success("Note added");
      setNoteFor(null);
      setNoteText("");
      qc.invalidateQueries({ queryKey: ["activities-all"] });
      qc.invalidateQueries({ queryKey: ["institute"] });
      qc.invalidateQueries({ queryKey: ["last-activity-map", type] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStage = useMutation({
    mutationFn: async ({
      id,
      name,
      stageId,
      note,
    }: {
      id: string;
      name: string;
      stageId: string;
      note: string;
    }) => {
      const stage = stages.find((s) => s.id === stageId);
      const { error } = await supabase
        .from("institutes")
        .update({ current_stage_id: stageId, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      await supabase.from("outreach_activities").insert({
        institute_id: id,
        stage_id: stageId,
        stage_name_snapshot: stage?.name,
        note: `Stage → ${stage?.name}: ${note.trim()}`,
        created_by: user?.id ?? null,
      });
      await logAction({
        action: "stage.updated",
        entity_type: "institute",
        entity_id: id,
        entity_label: name,
        details: { stage: stage?.name, note },
      });
    },
    onSuccess: () => {
      toast.success("Status updated");
      setStageChange(null);
      setStageNote("");
      qc.invalidateQueries({ queryKey: ["institutes", type] });
      qc.invalidateQueries({ queryKey: ["activities-all"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["last-activity-map", type] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cities = useMemo(
    () => Array.from(new Set(list.map((i) => i.city).filter(Boolean))).sort() as string[],
    [list],
  );
  const states = useMemo(
    () => Array.from(new Set(list.map((i) => i.state).filter(Boolean))).sort() as string[],
    [list],
  );

  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  const isStale = (i: Institute) => {
    if (!i.current_stage_id) return false;
    const last = lastActivityMap[i.id];
    const ref = last ? new Date(last) : new Date(i.updated_at ?? i.created_at);
    return Date.now() - ref.getTime() > SEVEN_DAYS;
  };

  const filtered = useMemo(() => {
    const m = q.trim().toLowerCase();
    let out = list.filter((i) => {
      if (stageFilter === "none" && i.current_stage_id) return false;
      if (stageFilter !== "all" && stageFilter !== "none" && i.current_stage_id !== stageFilter)
        return false;
      if (cityFilter !== "all" && i.city !== cityFilter) return false;
      if (stateFilter !== "all" && i.state !== stateFilter) return false;
      if (!m) return true;
      return [i.name, i.city, i.state, i.contact_person, i.contact_designation].some((v) =>
        v?.toLowerCase().includes(m),
      );
    });
    out = [...out].sort((a, b) => {
      const sa = isStale(a) ? 1 : 0;
      const sb = isStale(b) ? 1 : 0;
      if (sa !== sb) return sb - sa;
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "stage") {
        const ai = stages.findIndex((s) => s.id === a.current_stage_id);
        const bi = stages.findIndex((s) => s.id === b.current_stage_id);
        return bi - ai;
      }
      if (sortBy === "meeting") {
        const at = a.next_meeting_at ? +new Date(a.next_meeting_at) : Infinity;
        const bt = b.next_meeting_at ? +new Date(b.next_meeting_at) : Infinity;
        return at - bt;
      }
      return +new Date(b.updated_at ?? b.created_at) - +new Date(a.updated_at ?? a.created_at);
    });
    return out.map((i): InstituteWithMeta => {
      const stage = stages.find((s) => s.id === i.current_stage_id);
      const idx = stage ? stages.findIndex((s) => s.id === stage.id) + 1 : 0;
      const lastAct = lastActivityMap[i.id];
      return {
        ...i,
        stage,
        pct: stages.length ? Math.round((idx / stages.length) * 100) : 0,
        typePath: type === "college" ? "colleges" : "coaching",
        stale: isStale(i),
        daysSince: lastAct
          ? Math.floor((Date.now() - new Date(lastAct).getTime()) / 86400000)
          : null,
        accent: stage?.color ?? "var(--primary)",
      };
    });
  }, [list, q, stageFilter, cityFilter, stateFilter, sortBy, stages, lastActivityMap]);

  const staleCount = useMemo(() => list.filter(isStale).length, [list, lastActivityMap]);
  const activeFilterCount = [stageFilter, cityFilter, stateFilter].filter(
    (v) => v !== "all",
  ).length;
  const clearFilters = () => {
    setStageFilter("all");
    setCityFilter("all");
    setStateFilter("all");
    setQ("");
  };

  const openStageNote = (i: InstituteWithMeta, stageId: string) => {
    const s = stages.find((x) => x.id === stageId);
    if (!s || stageId === i.current_stage_id) return;
    setStageChange({ id: i.id, name: i.name, stageId, stageName: s.name });
    setStageNote("");
  };

  const StageBadge = ({ i }: { i: InstituteWithMeta }) =>
    i.stage ? (
      <Badge
        style={{
          background: `${i.stage.color}20`,
          color: i.stage.color,
          borderColor: `${i.stage.color}40`,
        }}
        variant="outline"
        className="max-w-full truncate"
      >
        {i.stage.name}
      </Badge>
    ) : (
      <Badge variant="secondary">No stage</Badge>
    );

  const StageSelect = ({ i, compact = false }: { i: InstituteWithMeta; compact?: boolean }) => (
    <Select value={i.current_stage_id ?? undefined} onValueChange={(v) => openStageNote(i, v)}>
      <SelectTrigger className={`${compact ? "h-8" : "h-9"} min-w-0 text-xs sm:w-44`}>
        <SelectValue placeholder="Set stage" />
      </SelectTrigger>
      <SelectContent>
        {stages.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
              {s.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const MetaLine = ({ i }: { i: InstituteWithMeta }) => (
    <div className="mt-1.5 flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {(i.city || i.state) && (
        <span className="inline-flex min-w-0 items-center gap-1">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{[i.city, i.state].filter(Boolean).join(", ")}</span>
        </span>
      )}
      {i.website && (
        <span className="inline-flex items-center gap-1">
          <Globe className="h-3 w-3" />
          Website
        </span>
      )}
      {i.contact_person && <span className="truncate">Contact: {i.contact_person}</span>}
      {i.next_meeting_at && (
        <span className="inline-flex items-center gap-1">
          <CalendarPlus className="h-3 w-3" />
          {new Date(i.next_meeting_at).toLocaleDateString()}
        </span>
      )}
      {i.daysSince !== null && (
        <span className={i.stale ? "font-medium text-destructive" : ""}>
          Last activity: {i.daysSince}d ago
        </span>
      )}
    </div>
  );

  const NotePopover = ({ i, trigger }: { i: InstituteWithMeta; trigger: ReactNode }) => (
    <Popover
      open={noteFor === i.id}
      onOpenChange={(o) => {
        if (!o) {
          setNoteFor(null);
          setNoteText("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <span
          onClick={() => {
            setNoteFor(i.id);
            setNoteText("");
          }}
        >
          {trigger}
        </span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[calc(100vw-2rem)] max-w-80">
        <div className="space-y-2">
          <p className="text-xs font-medium">New note for {i.name}</p>
          <Textarea
            rows={3}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="What happened today?"
          />
          <Button
            size="sm"
            className="w-full"
            disabled={addNote.isPending || !noteText.trim()}
            onClick={() => addNote.mutate({ id: i.id, name: i.name })}
          >
            Save note
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );

  const ActionStrip = ({ i, dense = false }: { i: InstituteWithMeta; dense?: boolean }) => {
    const sizeClass = dense ? "h-7 w-7 p-0" : "h-8 min-w-0 flex-1 gap-1 px-2 text-xs sm:flex-none";
    const iconClass = dense ? "h-3.5 w-3.5" : "h-3.5 w-3.5 shrink-0";
    return (
      <div
        className={
          dense
            ? "flex items-center justify-end gap-0.5"
            : "grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end"
        }
      >
        <InstituteTimelineDialog
          instituteId={i.id}
          instituteName={i.name}
          trigger={
            <Button
              size="sm"
              variant={dense ? "ghost" : "outline"}
              className={sizeClass}
              title="Timeline"
            >
              <Activity className={iconClass} />
              {!dense && "Timeline"}
            </Button>
          }
        />
        <MeetingDialog
          defaultInstituteId={i.id}
          defaultTitle={`Meeting with ${i.name}`}
          trigger={
            <Button size="sm" variant="outline" className={sizeClass} title="Schedule meeting">
              <CalendarPlus className={iconClass} />
              {!dense && "Schedule"}
            </Button>
          }
        />
        <AddTaskPopover
          instituteId={i.id}
          instituteName={i.name}
          trigger={
            <Button size="sm" variant="outline" className={sizeClass} title="Add task">
              {dense ? <List className={iconClass} /> : <>Task</>}
            </Button>
          }
        />
        <NotePopover
          i={i}
          trigger={
            <Button size="sm" variant="outline" className={sizeClass} title="Add note">
              <MessageSquarePlus className={iconClass} />
              {!dense && "Note"}
            </Button>
          }
        />
        <QuickDocUploadPopover
          instituteId={i.id}
          instituteName={i.name}
          trigger={
            <Button size="sm" variant="outline" className={sizeClass} title="Upload document">
              <Upload className={iconClass} />
              {!dense && "Doc"}
            </Button>
          }
        />
        <Link
          to="/outreach/$type/$id"
          params={{ type: i.typePath, id: i.id }}
          className={
            dense
              ? "inline-flex h-7 items-center rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              : "inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 sm:flex-none"
          }
        >
          Open {!dense && <ChevronRight className="h-3 w-3" />}
        </Link>
      </div>
    );
  };

  return (
    <RequireAuth perm={type === "college" ? "can_colleges" : "can_coaching"}>
      <AppShell title={title}>
        <div className="mx-auto w-full max-w-[1500px] space-y-4 sm:space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h2 className="truncate font-display text-xl font-bold sm:text-2xl">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <BulkAddInstituteDialog type={type} />
              <BulkDeleteInstituteDialog type={type} />
              <CreateInstituteDialog type={type} />
            </div>
          </div>

          <div className="rounded-xl border bg-card p-3 shadow-sm sm:p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_180px]">
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-10 pl-9"
                  placeholder="Search name, city, state, contact…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Recently updated</SelectItem>
                  <SelectItem value="name">Name (A–Z)</SelectItem>
                  <SelectItem value="stage">Stage (latest)</SelectItem>
                  <SelectItem value="meeting">Next meeting</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[150px_150px_150px_1fr_auto] lg:items-center">
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stages</SelectItem>
                  <SelectItem value="none">No stage set</SelectItem>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All cities</SelectItem>
                  {cities.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All states</SelectItem>
                  {states.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  {filtered.length} of {list.length}
                </span>
                {(activeFilterCount > 0 || q) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 px-2 text-xs"
                    onClick={clearFilters}
                  >
                    <X className="h-3 w-3" /> Clear
                  </Button>
                )}
              </div>
              <ToggleGroup
                type="single"
                size="sm"
                value={view}
                onValueChange={(v) => v && setViewPersist(v as ViewMode)}
                className="grid grid-cols-4 rounded-lg bg-muted/50 p-1 sm:flex"
              >
                <ToggleGroupItem
                  value="grid"
                  aria-label="Grid view"
                  className="h-8 gap-1 px-2 text-xs"
                >
                  <LayoutGrid className="h-4 w-4" />
                  <span className="hidden xl:inline">Grid</span>
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="list"
                  aria-label="List view"
                  className="h-8 gap-1 px-2 text-xs"
                >
                  <List className="h-4 w-4" />
                  <span className="hidden xl:inline">List</span>
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="table"
                  aria-label="Table view"
                  className="h-8 gap-1 px-2 text-xs"
                >
                  <TableIcon className="h-4 w-4" />
                  <span className="hidden xl:inline">Table</span>
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="compact"
                  aria-label="Compact view"
                  className="h-8 px-2 text-xs font-semibold"
                >
                  Compact
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {staleCount > 0 && (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 animate-pulse" />
                <span>
                  {staleCount} {staleCount === 1 ? "profile needs" : "profiles need"} attention — no
                  activity in 7+ days. Pinned to top.
                </span>
              </div>
            )}
          </div>

          {filtered.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-sm text-muted-foreground">No profiles found.</p>
              </CardContent>
            </Card>
          ) : view === "grid" ? (
            <div className="grid gap-3 sm:gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {filtered.map((i) => (
                <Card
                  key={i.id}
                  className={`relative h-full overflow-hidden border-border/70 shadow-sm ${i.stale ? "stale-alert" : ""}`}
                >
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-1"
                    style={{ background: `linear-gradient(90deg, ${i.accent}, transparent)` }}
                  />
                  <CardContent className="flex h-full flex-col gap-4 p-4 sm:p-5">
                    {i.stale && (
                      <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs font-medium text-destructive">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-pulse" />
                        <span>No activity for {i.daysSince ?? "7+"} days — follow up required</span>
                      </div>
                    )}
                    <div className="flex min-w-0 items-start gap-3">
                      <Link
                        to="/outreach/$type/$id"
                        params={{ type: i.typePath, id: i.id }}
                        className="min-w-0 flex-1 hover:text-primary"
                      >
                        <h3 className="line-clamp-2 font-display text-base font-semibold leading-tight sm:text-lg">
                          {i.name}
                        </h3>
                        <MetaLine i={i} />
                      </Link>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <EditInstituteDialog institute={i} type={type} />
                        <DeleteInstituteButton institute={i} type={type} />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Pipeline</span>
                          <span className="font-medium">{i.pct}%</span>
                        </div>
                        <Progress value={i.pct} className="h-1.5" />
                      </div>
                      <StageBadge i={i} />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                        Update status
                      </p>
                      <StageSelect i={i} />
                    </div>
                    <div className="mt-auto border-t pt-3">
                      <ActionStrip i={i} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : view === "list" ? (
            <div className="space-y-3">
              {filtered.map((i) => (
                <Card
                  key={i.id}
                  className={`relative overflow-hidden shadow-sm ${i.stale ? "border-destructive/40" : ""}`}
                >
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 w-1"
                    style={{ background: i.accent }}
                  />
                  <CardContent className="grid gap-4 p-4 pl-5 xl:grid-cols-[minmax(260px,1fr)_220px_320px] xl:items-center">
                    <div className="min-w-0">
                      <Link
                        to="/outreach/$type/$id"
                        params={{ type: i.typePath, id: i.id }}
                        className="hover:text-primary"
                      >
                        <div className="flex min-w-0 items-start gap-2">
                          {i.stale && (
                            <AlertTriangle className="mt-1 h-3.5 w-3.5 shrink-0 animate-pulse text-destructive" />
                          )}
                          <h3 className="line-clamp-2 font-display text-base font-semibold">
                            {i.name}
                          </h3>
                        </div>
                      </Link>
                      <MetaLine i={i} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                      <StageSelect i={i} />
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-muted-foreground">Pipeline</span>
                          <span className="font-medium">{i.pct}%</span>
                        </div>
                        <Progress value={i.pct} className="h-1.5" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <StageBadge i={i} />
                        <div className="flex items-center">
                          <EditInstituteDialog institute={i} type={type} />
                          <DeleteInstituteButton institute={i} type={type} />
                        </div>
                      </div>
                      <ActionStrip i={i} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : view === "table" ? (
            <>
              <div className="space-y-3 md:hidden">
                {filtered.map((i) => (
                  <Card key={i.id} className="shadow-sm">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <Link
                          to="/outreach/$type/$id"
                          params={{ type: i.typePath, id: i.id }}
                          className="min-w-0 hover:text-primary"
                        >
                          <h3 className="line-clamp-2 font-display text-base font-semibold">
                            {i.name}
                          </h3>
                          <MetaLine i={i} />
                        </Link>
                        <StageBadge i={i} />
                      </div>
                      <StageSelect i={i} />
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Pipeline</span>
                          <span>{i.pct}%</span>
                        </div>
                        <Progress value={i.pct} className="h-1.5" />
                      </div>
                      <div className="flex items-center justify-between gap-2 border-t pt-3">
                        <div className="flex">
                          <EditInstituteDialog institute={i} type={type} />
                          <DeleteInstituteButton institute={i} type={type} />
                        </div>
                        <ActionStrip i={i} dense />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card className="hidden overflow-hidden shadow-sm md:block">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[260px]">Profile</TableHead>
                        <TableHead className="min-w-[170px]">Status</TableHead>
                        <TableHead className="min-w-[170px]">Pipeline</TableHead>
                        <TableHead className="min-w-[130px]">Next meeting</TableHead>
                        <TableHead className="min-w-[120px]">Activity</TableHead>
                        <TableHead className="min-w-[220px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((i) => (
                        <TableRow key={i.id} className={i.stale ? "bg-destructive/5" : ""}>
                          <TableCell>
                            <Link
                              to="/outreach/$type/$id"
                              params={{ type: i.typePath, id: i.id }}
                              className="font-medium hover:text-primary"
                            >
                              <span className="inline-flex min-w-0 items-center gap-2">
                                {i.stale && (
                                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 animate-pulse text-destructive" />
                                )}
                                <span className="line-clamp-1">{i.name}</span>
                              </span>
                            </Link>
                            <MetaLine i={i} />
                          </TableCell>
                          <TableCell>
                            <StageSelect i={i} compact />
                          </TableCell>
                          <TableCell>
                            <div className="flex min-w-[130px] items-center gap-2">
                              <Progress value={i.pct} className="h-1.5 w-20" />
                              <span className="w-8 text-xs text-muted-foreground">{i.pct}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            {i.next_meeting_at
                              ? new Date(i.next_meeting_at).toLocaleDateString()
                              : "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {i.daysSince !== null ? (
                              <span
                                className={
                                  i.stale ? "font-medium text-destructive" : "text-muted-foreground"
                                }
                              >
                                {i.daysSince}d ago
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-1">
                              <ActionStrip i={i} dense />
                              <EditInstituteDialog institute={i} type={type} />
                              <DeleteInstituteButton institute={i} type={type} />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </>
          ) : (
            <div className="space-y-2">
              {filtered.map((i) => (
                <div
                  key={i.id}
                  className={`grid gap-2 rounded-lg border bg-card p-2.5 shadow-sm sm:grid-cols-[minmax(220px,1fr)_auto] sm:items-center ${i.stale ? "border-destructive/40" : "border-border"}`}
                >
                  <div className="flex min-w-0 items-start gap-2">
                    {i.stale && (
                      <AlertTriangle className="mt-1 h-3 w-3 shrink-0 animate-pulse text-destructive" />
                    )}
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{ background: i.accent }}
                    />
                    <Link
                      to="/outreach/$type/$id"
                      params={{ type: i.typePath, id: i.id }}
                      className="min-w-0 flex-1 hover:text-primary"
                    >
                      <span className="line-clamp-1 text-sm font-medium">{i.name}</span>
                      <MetaLine i={i} />
                    </Link>
                  </div>
                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <StageBadge i={i} />
                    <div className="flex shrink-0 items-center gap-0.5">
                      <ActionStrip i={i} dense />
                      <EditInstituteDialog institute={i} type={type} />
                      <DeleteInstituteButton institute={i} type={type} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Dialog
          open={!!stageChange}
          onOpenChange={(o) => {
            if (!o) {
              setStageChange(null);
              setStageNote("");
            }
          }}
        >
          <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Move to “{stageChange?.stageName}”</DialogTitle>
              <DialogDescription>
                Add a note explaining this stage change for {stageChange?.name}. This will be saved
                to the timeline.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="stage-note">Note *</Label>
              <Textarea
                id="stage-note"
                rows={4}
                autoFocus
                value={stageNote}
                onChange={(e) => setStageNote(e.target.value)}
                placeholder="What changed? Next steps?"
              />
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => {
                  setStageChange(null);
                  setStageNote("");
                }}
              >
                Cancel
              </Button>
              <Button
                disabled={!stageNote.trim() || updateStage.isPending}
                onClick={() =>
                  stageChange && updateStage.mutate({ ...stageChange, note: stageNote })
                }
              >
                {updateStage.isPending ? "Saving…" : "Update stage"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AppShell>
    </RequireAuth>
  );
}
