import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, differenceInCalendarDays, parseISO } from "date-fns";
import { CalendarPlus, Upload, X, FileText, Plane, Check, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { HRShell } from "@/components/hr/HRShell";
import { useMyEmployee, useLeaveTypes, HR_BUCKET } from "@/lib/hr";
import { toast } from "sonner";

export const Route = createFileRoute("/hrms/leaves")({
  component: () => <HRShell title="Leaves"><LeavesPage /></HRShell>,
});

function LeavesPage() {
  const { data: me } = useMyEmployee();
  const { data: types = [] } = useLeaveTypes();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: balances = [] } = useQuery({
    queryKey: ["hr-balances", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const year = new Date().getFullYear();
      const { data } = await supabase.from("hr_leave_balances")
        .select("*, leave_type:leave_type_id (id, name, color, code)")
        .eq("employee_id", me!.id).eq("year", year);
      return data ?? [];
    },
  });

  const { data: requests = [] } = useQuery({
    queryKey: ["hr-my-requests", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const { data } = await supabase.from("hr_leave_requests")
        .select("*, leave_type:leave_type_id (name, color)")
        .eq("employee_id", me!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: holidays = [] } = useQuery({
    queryKey: ["hr-holidays"],
    queryFn: async () => {
      const { data } = await supabase.from("hr_holidays").select("*").gte("holiday_date", new Date().toISOString().slice(0, 10)).order("holiday_date").limit(10);
      return data ?? [];
    },
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hr_leave_requests").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Leave cancelled"); qc.invalidateQueries({ queryKey: ["hr-my-requests", me?.id] }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!me) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-bold">My Leaves</h2>
          <p className="text-sm text-muted-foreground">Apply for leave, track approvals & balances.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><CalendarPlus className="mr-1 h-4 w-4" /> Apply leave</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Apply for leave</DialogTitle></DialogHeader>
            <ApplyLeaveForm employeeId={me.id} types={types} onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["hr-my-requests", me.id] }); }} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Balances */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Balances ({new Date().getFullYear()})</CardTitle></CardHeader>
        <CardContent>
          {balances.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">No balances allocated. Ask HR to set them up.</p> : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {balances.map((b: any) => {
                const a = Number(b.allocated), u = Number(b.used);
                const pct = a ? Math.min((u / a) * 100, 100) : 0;
                return (
                  <li key={b.id} className="rounded-lg border bg-card p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="inline-flex items-center gap-2 font-medium">
                        <span className="h-2 w-2 rounded-full" style={{ background: b.leave_type?.color }} />
                        {b.leave_type?.name}
                      </span>
                      <span className="text-xs text-muted-foreground">{u} / {a}</span>
                    </div>
                    <Progress value={pct} className="mt-2 h-1.5" />
                    <p className="mt-1 text-[11px] text-muted-foreground">{Math.max(a - u, 0)} remaining</p>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Requests */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">My requests</CardTitle></CardHeader>
        <CardContent>
          {requests.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">No requests yet.</p> : (
            <ul className="space-y-2">
              {requests.map((r: any) => (
                <li key={r.id} className="rounded-lg border bg-card p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        <span className="h-2 w-2 rounded-full" style={{ background: r.leave_type?.color }} />
                        {r.leave_type?.name}
                        <StatusBadge status={r.status} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {format(parseISO(r.from_date), "PP")} → {format(parseISO(r.to_date), "PP")} · {r.days} day(s)
                      </p>
                      {r.reason && <p className="mt-1 text-xs">{r.reason}</p>}
                      {r.manager_comment && <p className="mt-1 text-[11px] text-muted-foreground">Manager: {r.manager_comment}</p>}
                      {r.hr_comment && <p className="mt-0.5 text-[11px] text-muted-foreground">HR: {r.hr_comment}</p>}
                    </div>
                    {r.status === "pending" && (
                      <Button size="sm" variant="ghost" onClick={() => cancel.mutate(r.id)}><X className="mr-1 h-3 w-3" /> Cancel</Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Upcoming holidays */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Upcoming holidays</CardTitle></CardHeader>
        <CardContent>
          {holidays.length === 0 ? <p className="py-2 text-sm text-muted-foreground">No holidays scheduled.</p> : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {holidays.map((h: any) => (
                <li key={h.id} className="flex items-center gap-2 rounded-md border bg-card p-2 text-sm">
                  <Plane className="h-4 w-4 text-primary" />
                  <span className="flex-1 truncate">{h.name}</span>
                  <span className="text-xs text-muted-foreground">{format(parseISO(h.holiday_date), "EEE, PP")}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40",
    manager_approved: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40",
    approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40",
    rejected: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40",
    cancelled: "bg-muted text-muted-foreground",
  };
  return <Badge variant="outline" className={`border text-[10px] capitalize ${map[status] ?? ""}`}>{status.replace("_", " ")}</Badge>;
}

function ApplyLeaveForm({ employeeId, types, onDone }: { employeeId: string; types: any[]; onDone: () => void }) {
  const [typeId, setTypeId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const selectedType = types.find((t) => t.id === typeId);
  const days = from && to ? Math.max(differenceInCalendarDays(parseISO(to), parseISO(from)) + 1, 0) : 0;

  async function submit() {
    if (!typeId || !from || !to) { toast.error("Fill all required fields"); return; }
    if (days <= 0) { toast.error("Invalid date range"); return; }
    if (selectedType?.requires_doc && !file) { toast.error("This leave type needs a document"); return; }
    setPending(true);
    try {
      let docPath: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${employeeId}/leaves/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from(HR_BUCKET).upload(path, file, { contentType: file.type || undefined });
        if (upErr) throw upErr;
        docPath = path;
      }
      const { error } = await supabase.from("hr_leave_requests").insert({
        employee_id: employeeId, leave_type_id: typeId, from_date: from, to_date: to,
        days, reason: reason.trim() || null, document_path: docPath,
      });
      if (error) throw error;
      toast.success("Leave request submitted");
      onDone();
    } catch (e: any) { toast.error(e.message); }
    finally { setPending(false); }
  }

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Leave type *</Label>
        <Select value={typeId} onValueChange={setTypeId}>
          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
          <SelectContent>
            {types.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} {t.requires_doc && "📎"}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">From *</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label className="text-xs">To *</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      {days > 0 && <p className="text-xs text-muted-foreground">{days} day(s)</p>}
      <div>
        <Label className="text-xs">Reason</Label>
        <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Brief reason…" />
      </div>
      {selectedType?.requires_doc && (
        <div>
          <Label className="text-xs">Document * (medical certificate, etc.)</Label>
          <label className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-3 text-xs hover:bg-accent">
            <Upload className="h-4 w-4" />
            <span>{file ? file.name : "Choose file"}</span>
            <input type="file" className="hidden" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
      )}
      <Button className="w-full" disabled={pending} onClick={submit}>{pending ? "Submitting…" : "Submit request"}</Button>
    </div>
  );
}
