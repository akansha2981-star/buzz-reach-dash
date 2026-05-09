import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Check, X, Filter, Calendar, Download, ClipboardList } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { HRShell } from "@/components/hr/HRShell";
import { useLeaveTypes, useMyEmployee, isHRAdminRole, type HRLeaveStatus, HR_BUCKET } from "@/lib/hr";

export const Route = createFileRoute("/hrms/admin/leaves")({
  component: () => <HRShell title="Leave Approvals"><AdminLeavesPage /></HRShell>,
});

function AdminLeavesPage() {
  const { data: me } = useMyEmployee();
  const isAdmin = isHRAdminRole(me?.hr_role);
  const { data: leaveTypes = [] } = useLeaveTypes();
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [decision, setDecision] = useState<{ id: string; action: "approved" | "rejected" } | null>(null);
  const [comment, setComment] = useState("");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["hr-leave-queue", statusFilter, typeFilter],
    queryFn: async () => {
      let q = supabase.from("hr_leave_requests").select("*").order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter as HRLeaveStatus);
      if (typeFilter !== "all") q = q.eq("leave_type_id", typeFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const empIds = useMemo(() => Array.from(new Set(requests.map((r: any) => r.employee_id))), [requests]);
  const { data: empMap = {} } = useQuery({
    queryKey: ["hr-emp-map", empIds],
    enabled: empIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("hr_employees").select("id, full_name, designation, employee_code").in("id", empIds);
      const map: Record<string, any> = {};
      (data ?? []).forEach((e) => (map[e.id] = e));
      return map;
    },
  });

  const decide = useMutation({
    mutationFn: async ({ id, action, cmt }: { id: string; action: "approved" | "rejected"; cmt: string }) => {
      const patch: any = isAdmin
        ? { status: action, hr_id: me?.id, hr_comment: cmt || null, hr_decision_at: new Date().toISOString() }
        : { status: action === "approved" ? "manager_approved" : "rejected", manager_id: me?.id, manager_comment: cmt || null, manager_decision_at: new Date().toISOString() };
      const { error } = await supabase.from("hr_leave_requests").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Decision recorded");
      qc.invalidateQueries({ queryKey: ["hr-leave-queue"] });
      setDecision(null);
      setComment("");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const downloadDoc = async (path: string) => {
    const { data, error } = await supabase.storage.from(HR_BUCKET).createSignedUrl(path, 60);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <div className="flex items-center gap-2 text-sm font-medium"><Filter className="h-4 w-4" /> Filters</div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full lg:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="manager_approved">Manager Approved</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full lg:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {leaveTypes.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card/50 py-16 text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No leave requests match these filters.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((r: any) => {
            const emp = empMap[r.employee_id];
            const lt = leaveTypes.find((t) => t.id === r.leave_type_id);
            return (
              <Card key={r.id}>
                <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{emp?.full_name ?? "—"}</span>
                      {emp?.employee_code && <Badge variant="secondary" className="text-[10px]">{emp.employee_code}</Badge>}
                      <Badge variant="outline" style={lt ? { borderColor: lt.color, color: lt.color } : undefined}>{lt?.name ?? "Leave"}</Badge>
                      <StatusPill status={r.status} />
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(r.from_date), "MMM dd")} – {format(new Date(r.to_date), "MMM dd, yyyy")} · {r.days} day(s)
                    </div>
                    {r.reason && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{r.reason}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {r.document_path && (
                      <Button size="sm" variant="outline" onClick={() => downloadDoc(r.document_path)}>
                        <Download className="h-3.5 w-3.5" /> Doc
                      </Button>
                    )}
                    {(r.status === "pending" || (isAdmin && r.status === "manager_approved")) && (
                      <>
                        <Button size="sm" variant="outline" className="border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300" onClick={() => setDecision({ id: r.id, action: "approved" })}>
                          <Check className="h-3.5 w-3.5" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" className="border-rose-500/40 text-rose-700 hover:bg-rose-500/10 dark:text-rose-300" onClick={() => setDecision({ id: r.id, action: "rejected" })}>
                          <X className="h-3.5 w-3.5" /> Reject
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!decision} onOpenChange={(o) => { if (!o) { setDecision(null); setComment(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{decision?.action === "approved" ? "Approve" : "Reject"} Leave</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Comment (optional)</Label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="Reason or note for the employee…" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDecision(null); setComment(""); }}>Cancel</Button>
            <Button onClick={() => decision && decide.mutate({ id: decision.id, action: decision.action, cmt: comment })} disabled={decide.isPending}>
              {decide.isPending ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusPill({ status }: { status: HRLeaveStatus }) {
  const map: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40",
    manager_approved: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40",
    approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40",
    rejected: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40",
    cancelled: "bg-muted text-muted-foreground border-muted",
  };
  return <Badge variant="outline" className={map[status]}>{status.replace("_", " ")}</Badge>;
}
