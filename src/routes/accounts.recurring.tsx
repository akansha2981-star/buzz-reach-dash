import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Repeat, Power, CheckCircle2, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format, startOfMonth } from "date-fns";

export const Route = createFileRoute("/accounts/recurring")({ component: RecurringPage });

type Rec = {
  id: string; title: string; category: string | null; amount: number;
  currency: string; frequency: string; next_due: string; is_active: boolean; notes: string | null;
};

const FREQS = ["weekly", "monthly", "quarterly", "yearly"];
const CATEGORIES = ["Software", "Rent", "Salaries", "Utilities", "Marketing", "Other"];

function RecurringPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Rec | null>(null);
  const [historyFor, setHistoryFor] = useState<Rec | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["accounts_recurring"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts_recurring_expenses").select("*").order("next_due");
      if (error) throw error;
      return data as Rec[];
    },
  });

  const { data: allPayments = [] } = useQuery({
    queryKey: ["accounts_recurring_payments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts_recurring_expense_payments").select("*").order("paid_on", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("accounts_recurring_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["accounts_recurring"] }); },
  });

  const toggle = useMutation({
    mutationFn: async (r: Rec) => {
      const { error } = await supabase.from("accounts_recurring_expenses").update({ is_active: !r.is_active }).eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts_recurring"] }),
  });

  const markPaid = useMutation({
    mutationFn: async (r: Rec) => {
      const { data: { user } } = await supabase.auth.getUser();
      const period = format(startOfMonth(new Date()), "yyyy-MM-dd");
      const { error } = await supabase.from("accounts_recurring_expense_payments").insert({
        recurring_expense_id: r.id,
        paid_on: new Date().toISOString().slice(0, 10),
        period_month: period,
        amount: r.amount,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marked as paid");
      qc.invalidateQueries({ queryKey: ["accounts_recurring_payments"] });
      qc.invalidateQueries({ queryKey: ["sum_rec_payments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const paidThisMonth = (id: string) => {
    const key = format(startOfMonth(new Date()), "yyyy-MM");
    return allPayments.some((p: any) => p.recurring_expense_id === id && (p.period_month || "").slice(0, 7) === key);
  };

  const activeMonthly = rows.filter(r => r.is_active && r.frequency === "monthly").reduce((s, r) => s + Number(r.amount), 0);
  const activeAll = rows.filter(r => r.is_active).length;
  const paidTotal = allPayments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Active recurring" value={activeAll.toString()} />
        <StatCard label="Monthly outflow" value={`₹${activeMonthly.toLocaleString()}`} tone="amber" />
        <StatCard label="Total paid (all time)" value={`₹${Math.round(paidTotal).toLocaleString()}`} tone="emerald" />
        <div className="flex items-center justify-end">
          <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-1 h-4 w-4" />New recurring</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
              <Repeat className="h-8 w-8" />
              <p className="text-sm">No recurring expenses yet.</p>
            </div>
          ) : (
            <div className="divide-y">
              {rows.map((r) => {
                const isPaid = paidThisMonth(r.id);
                return (
                  <div key={r.id} className={`flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between ${!r.is_active ? "opacity-60" : ""}`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{r.title}</span>
                        <Badge variant="secondary">{r.frequency}</Badge>
                        {r.category && <Badge variant="outline">{r.category}</Badge>}
                        {!r.is_active && <Badge className="bg-muted text-muted-foreground">paused</Badge>}
                        {isPaid && <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">paid this month</Badge>}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">Next due · {format(new Date(r.next_due), "dd MMM yyyy")}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-semibold">{r.currency} {Number(r.amount).toLocaleString()}</div>
                      <Button size="sm" variant={isPaid ? "outline" : "default"} disabled={isPaid || markPaid.isPending} onClick={() => markPaid.mutate(r)}>
                        <CheckCircle2 className="mr-1 h-4 w-4" />{isPaid ? "Paid" : "Mark paid"}
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setHistoryFor(r)} title="Payment history"><History className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => toggle.mutate(r)} title={r.is_active ? "Pause" : "Activate"}><Power className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete?")) del.mutate(r.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <RecDialog open={open} onOpenChange={setOpen} editing={editing} />
      <HistoryDialog rec={historyFor} onOpenChange={(o) => !o && setHistoryFor(null)} payments={allPayments.filter((p: any) => p.recurring_expense_id === historyFor?.id)} />
    </div>
  );
}

function HistoryDialog({ rec, onOpenChange, payments }: { rec: Rec | null; onOpenChange: (o: boolean) => void; payments: any[] }) {
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("accounts_recurring_expense_payments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["accounts_recurring_payments"] });
      qc.invalidateQueries({ queryKey: ["sum_rec_payments"] });
    },
  });
  return (
    <Dialog open={!!rec} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Payment history · {rec?.title}</DialogTitle></DialogHeader>
        {payments.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No payments recorded yet.</div>
        ) : (
          <div className="max-h-[400px] divide-y overflow-y-auto">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <div className="font-medium">{format(new Date(p.paid_on), "dd MMM yyyy")}</div>
                  <div className="text-xs text-muted-foreground">Period · {format(new Date(p.period_month), "MMM yyyy")}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="font-semibold">₹{Number(p.amount).toLocaleString()}</div>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remove?")) remove.mutate(p.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const toneCls = tone === "amber" ? "text-amber-600" : "text-foreground";
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${toneCls}`}>{value}</div>
    </CardContent></Card>
  );
}

function RecDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (o: boolean) => void; editing: Rec | null }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<Rec>>({});
  const reset = () => setForm(editing ?? { currency: "INR", frequency: "monthly", next_due: new Date().toISOString().slice(0, 10), amount: 0, is_active: true });
  useEffect(() => { if (open) reset(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open, editing]);

  const isEdit = !!editing;
  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form }; delete payload.id;
      if (isEdit) {
        const { error } = await supabase.from("accounts_recurring_expenses").update(payload).eq("id", editing!.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from("accounts_recurring_expenses").insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Updated" : "Created");
      qc.invalidateQueries({ queryKey: ["accounts_recurring"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{isEdit ? "Edit recurring expense" : "New recurring expense"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Title *</Label><Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Amount</Label><Input type="number" value={form.amount ?? 0} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div>
            <div><Label>Currency</Label><Input value={form.currency ?? "INR"} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Frequency</Label>
              <Select value={form.frequency ?? "monthly"} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FREQS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Next due</Label><Input type="date" value={form.next_due ?? ""} onChange={(e) => setForm({ ...form, next_due: e.target.value })} /></div>
          </div>
          <div>
            <Label>Category</Label>
            <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="">—</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><Label>Notes</Label><Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!form.title || save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
