import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { Crown, MessageSquare, CheckCircle2, XCircle, Activity, Search, Filter, AlertCircle, Pencil } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/useRealtime";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ceo-desk")({
  component: () => (
    <RequireAuth>
      <AppShell title="CEO Desk"><CEODeskPage /></AppShell>
    </RequireAuth>
  ),
});

const PRIORITY_COLOR: Record<string, string> = {
  low: "bg-slate-500",
  normal: "bg-blue-500",
  high: "bg-amber-500",
  urgent: "bg-rose-500",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-500",
  in_review: "bg-blue-500",
  approved: "bg-emerald-500",
  closed: "bg-slate-500",
};

function CEODeskPage() {
  useRealtime("ceo_desk_requests", [["ceo-desk"]]);
  useRealtime("ceo_desk_notes", [["ceo-desk"]]);
  const { isAdmin, user } = useAuth();
  const [tab, setTab] = useState("pending");
  const [q, setQ] = useState("");
  const [pri, setPri] = useState("all");
  const [src, setSrc] = useState("all");

  const { data: requests = [] } = useQuery({
    queryKey: ["ceo-desk"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ceo_desk_requests")
        .select("*, institutes(name, type)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const filtered = useMemo(() => requests.filter((r) => {
    if (pri !== "all" && r.priority !== pri) return false;
    if (src !== "all" && r.source_type !== src) return false;
    if (q && !`${r.title} ${r.message ?? ""} ${r.requester_email ?? ""} ${r.institutes?.name ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [requests, pri, src, q]);

  const byStatus = (s: string) => filtered.filter((r) => r.status === s);
  const counts = {
    pending: requests.filter((r) => r.status === "pending").length,
    in_review: requests.filter((r) => r.status === "in_review").length,
    approved: requests.filter((r) => r.status === "approved").length,
    closed: requests.filter((r) => r.status === "closed").length,
    urgent: requests.filter((r) => r.priority === "urgent" && r.status !== "closed").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold flex items-center gap-2">
            <Crown className="h-6 w-6 text-amber-600" /> CEO Desk
          </h2>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Requests, escalations & approvals from your team" : "Your requests sent to the CEO"}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Pending" value={counts.pending} tone="amber" />
        <Stat label="In Review" value={counts.in_review} tone="blue" />
        <Stat label="Approved" value={counts.approved} tone="emerald" />
        <Stat label="Closed" value={counts.closed} />
        <Stat label="Urgent (open)" value={counts.urgent} tone="rose" />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Filter className="h-4 w-4" /> Filters</CardTitle>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56 pl-8" />
            </div>
            <Select value={pri} onValueChange={setPri}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priority</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={src} onValueChange={setSrc}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="task">Task</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">Pending ({byStatus("pending").length})</TabsTrigger>
          <TabsTrigger value="in_review">In Review ({byStatus("in_review").length})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({byStatus("approved").length})</TabsTrigger>
          <TabsTrigger value="closed">Closed ({byStatus("closed").length})</TabsTrigger>
          <TabsTrigger value="all">All ({filtered.length})</TabsTrigger>
        </TabsList>
        {["pending", "in_review", "approved", "closed", "all"].map((s) => (
          <TabsContent key={s} value={s} className="mt-4 space-y-3">
            {(s === "all" ? filtered : byStatus(s)).map((r) => (
              <RequestCard key={r.id} r={r} canManage={isAdmin} currentUserId={user?.id} />
            ))}
            {(s === "all" ? filtered : byStatus(s)).length === 0 && (
              <p className="py-12 text-center text-sm text-muted-foreground">No requests in this view.</p>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "amber" | "blue" | "emerald" | "rose" }) {
  const colors: Record<string, string> = {
    amber: "text-amber-600", blue: "text-blue-600", emerald: "text-emerald-600", rose: "text-rose-600",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase text-muted-foreground">{label}</p>
        <p className={cn("font-display text-2xl font-bold", tone && colors[tone])}>{value}</p>
      </CardContent>
    </Card>
  );
}

function RequestCard({ r, canManage, currentUserId }: { r: any; canManage: boolean; currentUserId?: string }) {
  const qc = useQueryClient();
  const [openNotes, setOpenNotes] = useState(false);
  const [editCeoNote, setEditCeoNote] = useState(false);
  const [ceoNote, setCeoNote] = useState(r.ceo_notes ?? "");

  const update = useMutation({
    mutationFn: async (patch: any) => {
      const { error } = await supabase.from("ceo_desk_requests").update({
        ...patch,
        handled_by: currentUserId,
        handled_at: new Date().toISOString(),
      }).eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["ceo-desk"] }); setEditCeoNote(false); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className={cn("border-l-4", r.priority === "urgent" && "border-l-rose-500", r.priority === "high" && "border-l-amber-500", r.priority === "normal" && "border-l-blue-500", r.priority === "low" && "border-l-slate-400")}>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-lg font-semibold">{r.title}</h3>
              <Badge className={cn("gap-1", PRIORITY_COLOR[r.priority], "text-white hover:opacity-90")}>{r.priority}</Badge>
              <Badge variant="outline" className="gap-1"><span className={cn("h-2 w-2 rounded-full", STATUS_COLOR[r.status])} />{r.status.replace("_", " ")}</Badge>
              <Badge variant="secondary">{r.source_type}</Badge>
            </div>
            {r.message && <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{r.message}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>From: <strong className="text-foreground">{r.requester_email ?? "—"}</strong></span>
              <span>{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
              {r.institutes && (
                <Link to="/outreach/$type/$id" params={{ type: r.institutes.type === "college" ? "colleges" : "coaching", id: r.institute_id }} className="text-primary hover:underline">
                  {r.institutes.name}
                </Link>
              )}
            </div>
          </div>
          {canManage && r.status !== "closed" && (
            <div className="flex flex-wrap gap-1">
              {r.status === "pending" && (
                <Button size="sm" variant="outline" onClick={() => update.mutate({ status: "in_review" })}>
                  <Activity className="mr-1 h-3.5 w-3.5" /> Review
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => update.mutate({ status: "approved" })}>
                <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-600" /> Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => update.mutate({ status: "closed" })}>
                <XCircle className="mr-1 h-3.5 w-3.5 text-rose-600" /> Close
              </Button>
            </div>
          )}
        </div>

        {(r.ceo_notes || canManage) && (
          <div className="rounded-md border bg-amber-50 p-2 dark:bg-amber-950/20">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                <Crown className="h-3 w-3" /> CEO Note
              </p>
              {canManage && (
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditCeoNote((v) => !v)}>
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
            </div>
            {editCeoNote ? (
              <div className="mt-1 space-y-2">
                <Textarea rows={2} value={ceoNote} onChange={(e) => setCeoNote(e.target.value)} />
                <Button size="sm" onClick={() => update.mutate({ ceo_notes: ceoNote })}>Save</Button>
              </div>
            ) : (
              <p className="text-sm">{r.ceo_notes || <span className="text-muted-foreground">No CEO note yet.</span>}</p>
            )}
          </div>
        )}

        <Button size="sm" variant="ghost" onClick={() => setOpenNotes(true)}>
          <MessageSquare className="mr-1 h-3.5 w-3.5" /> Activity & Notes
        </Button>
      </CardContent>
      <NotesDialog open={openNotes} onOpenChange={setOpenNotes} requestId={r.id} title={r.title} />
    </Card>
  );
}

function NotesDialog({ open, onOpenChange, requestId, title }: { open: boolean; onOpenChange: (v: boolean) => void; requestId: string; title: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [note, setNote] = useState("");
  const { data: notes = [] } = useQuery({
    queryKey: ["ceo-desk-notes", requestId],
    queryFn: async () => {
      const { data, error } = await supabase.from("ceo_desk_notes").select("*").eq("request_id", requestId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: open,
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!note.trim() || !user) return;
      const { error } = await supabase.from("ceo_desk_notes").insert({
        request_id: requestId,
        author_id: user.id,
        author_email: user.email ?? null,
        note: note.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNote("");
      qc.invalidateQueries({ queryKey: ["ceo-desk-notes", requestId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Notes — {title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Textarea rows={3} placeholder="Add a note…" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button size="sm" disabled={!note.trim() || add.isPending} onClick={() => add.mutate()}>Add note</Button>
          </div>
          <div className="max-h-80 space-y-2 overflow-auto">
            {notes.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No notes yet.</p>}
            {notes.map((n) => (
              <div key={n.id} className="rounded-md border bg-muted/30 p-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{n.author_email ?? "—"}</span>
                  <span>{format(new Date(n.created_at), "MMM d, h:mm a")}</span>
                </div>
                <p className="mt-1 text-sm whitespace-pre-wrap">{n.note}</p>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
