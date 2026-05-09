import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Pin, Megaphone, Trash2, Pencil, Eye, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { HRShell } from "@/components/hr/HRShell";
import { useMyEmployee, isHRAdminRole } from "@/lib/hr";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/hrms/announcements")({
  component: () => <HRShell title="Announcements"><AnnouncementsPage /></HRShell>,
});

const AUDIENCES = [
  { value: "all", label: "Everyone" },
  { value: "managers", label: "Managers Only" },
  { value: "employees", label: "Employees Only" },
  { value: "interns", label: "Interns Only" },
];

function AnnouncementsPage() {
  const { data: me } = useMyEmployee();
  const isAdmin = isHRAdminRole(me?.hr_role);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { data: anns = [] } = useQuery({
    queryKey: ["hr-announcements"],
    queryFn: async () => {
      const { data } = await supabase.from("hr_announcements").select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: myReads = [] } = useQuery({
    queryKey: ["hr-ann-reads", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const { data } = await supabase.from("hr_announcement_reads").select("announcement_id").eq("employee_id", me!.id);
      return (data ?? []).map((r: any) => r.announcement_id);
    },
  });

  const visible = useMemo(() => anns.filter((a: any) => {
    if (a.audience === "all") return true;
    if (a.audience === "managers") return me?.hr_role === "manager" || me?.hr_role === "team_leader" || isAdmin;
    if (a.audience === "employees") return me?.hr_role === "employee";
    if (a.audience === "interns") return me?.hr_role === "intern";
    return true;
  }), [anns, me, isAdmin]);

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      if (!me || myReads.includes(id)) return;
      await supabase.from("hr_announcement_reads").insert({ announcement_id: id, employee_id: me.id });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-ann-reads"] }),
  });

  // auto-mark visible announcements as read after 1.2s
  useEffect(() => {
    if (!me) return;
    const t = setTimeout(() => {
      visible.forEach((a: any) => { if (!myReads.includes(a.id)) markRead.mutate(a.id); });
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible.length, me?.id]);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hr_announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["hr-announcements"] }); },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            <div>
              <div className="font-semibold">Company Announcements</div>
              <div className="text-xs text-muted-foreground">{visible.length} total · {visible.filter((a: any) => !myReads.includes(a.id)).length} unread</div>
            </div>
          </div>
          {isAdmin && (
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditing(null)}><Plus className="h-4 w-4" /> New</Button>
              </DialogTrigger>
              <AnnFormDialog editing={editing} onClose={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["hr-announcements"] }); }} />
            </Dialog>
          )}
        </CardContent>
      </Card>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed py-16 text-center">
          <Megaphone className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No announcements yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((a: any) => {
            const isUnread = !myReads.includes(a.id);
            return (
              <Card key={a.id} className={cn("transition-all", a.pinned && "border-amber-500/40 bg-amber-500/5", isUnread && "border-l-4 border-l-primary")}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {a.pinned && <Pin className="h-4 w-4 text-amber-500" />}
                      <h3 className="font-display text-base font-semibold">{a.title}</h3>
                      {isUnread && <Badge className="bg-primary text-primary-foreground text-[10px]">NEW</Badge>}
                      <Badge variant="secondary" className="text-[10px]">{AUDIENCES.find((x) => x.value === a.audience)?.label}</Badge>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(a); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { if (confirm("Delete announcement?")) remove.mutate(a.id); }}><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>
                      </div>
                    )}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>
                  <div className="mt-2 text-[10px] text-muted-foreground">{format(new Date(a.created_at), "PPp")}</div>
                  {isAdmin && <ReadCount id={a.id} />}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReadCount({ id }: { id: string }) {
  const { data } = useQuery({
    queryKey: ["hr-ann-readcount", id],
    queryFn: async () => {
      const { count } = await supabase.from("hr_announcement_reads").select("id", { count: "exact", head: true }).eq("announcement_id", id);
      return count ?? 0;
    },
  });
  return <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground"><Eye className="h-2.5 w-2.5" /> {data ?? 0} read</div>;
}

function AnnFormDialog({ editing, onClose }: { editing: any | null; onClose: () => void }) {
  const { data: me } = useMyEmployee();
  const [form, setForm] = useState({
    title: editing?.title ?? "",
    body: editing?.body ?? "",
    audience: editing?.audience ?? "all",
    pinned: editing?.pinned ?? false,
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, created_by: editing?.created_by ?? me?.id };
      if (editing) {
        const { error } = await supabase.from("hr_announcements").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("hr_announcements").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(editing ? "Updated" : "Posted"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader><DialogTitle>{editing ? "Edit Announcement" : "New Announcement"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1"><Label className="text-xs">Title *</Label><Input maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div className="space-y-1"><Label className="text-xs">Body *</Label><Textarea rows={6} maxLength={5000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label className="text-xs">Audience</Label>
            <Select value={form.audience} onValueChange={(v) => setForm({ ...form, audience: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{AUDIENCES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-lg border px-3">
            <Label className="text-xs">Pin to top</Label>
            <Switch checked={form.pinned} onCheckedChange={(v) => setForm({ ...form, pinned: v })} />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => save.mutate()} disabled={!form.title.trim() || !form.body.trim() || save.isPending}>{save.isPending ? "Saving…" : "Post"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
