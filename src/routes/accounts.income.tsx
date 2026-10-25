import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { GstBox } from "@/components/accounts/GstBox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, HandCoins, TrendingUp, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/accounts/income")({ component: IncomePage });

type Income = {
  id: string;
  title: string;
  payer: string | null;
  category: string | null;
  amount: number;
  currency: string;
  received_on: string;
  payment_method: string | null;
  bank_account_id: string | null;
  reference: string | null;
  notes: string | null;
};

const CATEGORIES = ["Consulting", "Advance", "Refund", "Interest", "Commission", "Grant", "Other income"];
const METHODS = ["Bank transfer", "UPI", "Cash", "Cheque", "Card", "Other"];

const fmtINR = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

function IncomePage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Income | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["accounts_manual_income"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts_manual_income")
        .select("*")
        .order("received_on", { ascending: false });
      if (error) throw error;
      return data as Income[];
    },
  });

  const { data: banks = [] } = useQuery({
    queryKey: ["accounts_bank_accounts"],
    queryFn: async () => (await supabase.from("accounts_bank_accounts").select("id,tag,bank_name")).data ?? [],
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("accounts_manual_income").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Entry deleted");
      qc.invalidateQueries({ queryKey: ["accounts_manual_income"] });
      qc.invalidateQueries({ queryKey: ["sum_manual_income"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = filter === "all" ? rows : rows.filter((r) => r.category === filter);

  const stats = useMemo(() => {
    const now = new Date();
    const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
    const month = rows
      .filter((r) => {
        const d = new Date(r.received_on);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((s, r) => s + Number(r.amount || 0), 0);
    return { total, month };
  }, [rows]);

  const bankLabel = (id: string | null) => {
    const b: any = banks.find((x: any) => x.id === id);
    return b ? b.tag || b.bank_name : null;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={HandCoins} label="Total manual income" value={fmtINR(stats.total)} tone="emerald" sub={`${rows.length} entries`} />
        <Stat icon={CalendarDays} label="This month" value={fmtINR(stats.month)} tone="sky" />
        <Stat icon={TrendingUp} label="Showing" value={fmtINR(filtered.reduce((s, r) => s + Number(r.amount || 0), 0))} tone="indigo" sub={filter === "all" ? "All categories" : filter} />
        <div className="flex items-center justify-end">
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" />Add income
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>All</Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c} active={filter === c} onClick={() => setFilter(c)}>{c}</Chip>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
              <HandCoins className="h-8 w-8" />
              <p className="text-sm">No manual income recorded yet.</p>
              <p className="text-xs">Use this for cash received without an invoice.</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((inc) => (
                <div key={inc.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{inc.title}</span>
                      {inc.category && <Badge variant="secondary">{inc.category}</Badge>}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {format(new Date(inc.received_on), "dd MMM yyyy")}
                      {inc.payer && <> · {inc.payer}</>}
                      {inc.payment_method && <> · {inc.payment_method}</>}
                      {bankLabel(inc.bank_account_id) && <> · {bankLabel(inc.bank_account_id)}</>}
                      {inc.reference && <> · Ref {inc.reference}</>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="font-semibold text-emerald-600 dark:text-emerald-400">+{fmtINR(Number(inc.amount))}</div>
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(inc); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete this income entry?")) del.mutate(inc.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <IncomeDialog open={open} onOpenChange={setOpen} editing={editing} banks={banks as any[]} />
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-full border px-3 py-1 text-xs font-medium transition ${active ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}>
      {children}
    </button>
  );
}

function Stat({ icon: Icon, label, value, sub, tone }: { icon: any; label: string; value: string; sub?: string; tone?: string }) {
  const toneMap: Record<string, string> = {
    emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400",
    indigo: "from-indigo-500/15 to-indigo-500/5 text-indigo-600 dark:text-indigo-400",
    sky: "from-sky-500/15 to-sky-500/5 text-sky-600 dark:text-sky-400",
  };
  const cls = tone ? toneMap[tone] : "from-muted/40 to-muted/10 text-foreground";
  return (
    <Card className={`overflow-hidden border-border/60 bg-gradient-to-br ${cls}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
          <Icon className="h-4 w-4 opacity-70" />
        </div>
        <div className="mt-1 text-xl font-bold">{value}</div>
        {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function IncomeDialog({
  open, onOpenChange, editing, banks,
}: { open: boolean; onOpenChange: (o: boolean) => void; editing: Income | null; banks: any[] }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<Income>>({});
  useEffect(() => {
    if (open) {
      setForm(
        editing ?? {
          currency: "INR",
          received_on: new Date().toISOString().slice(0, 10),
          amount: 0,
        }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const isEdit = !!editing;
  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form };
      delete payload.id;
      delete payload.created_at;
      delete payload.updated_at;
      if (payload.bank_account_id === "") payload.bank_account_id = null;
      if (isEdit) {
        const { error } = await supabase.from("accounts_manual_income").update(payload).eq("id", editing!.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from("accounts_manual_income").insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Income updated" : "Income added");
      qc.invalidateQueries({ queryKey: ["accounts_manual_income"] });
      qc.invalidateQueries({ queryKey: ["sum_manual_income"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{isEdit ? "Edit income" : "Add manual income"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Title *</Label><Input placeholder="e.g. Cash received from workshop" value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Amount</Label><Input type="number" value={form.amount ?? 0} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div>
            <div><Label>Date received</Label><Input type="date" value={form.received_on ?? ""} onChange={(e) => setForm({ ...form, received_on: e.target.value })} /></div>
          </div>
          <GstBox applicable={!!(form as any).gst_applicable} amount={Number(form.amount || 0)} onChange={(v) => setForm({ ...form, gst_applicable: v } as any)} />
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Received from</Label><Input value={form.payer ?? ""} onChange={(e) => setForm({ ...form, payer: e.target.value })} /></div>
            <div><Label>Category</Label>
              <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">—</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Payment method</Label>
              <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.payment_method ?? ""} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                <option value="">—</option>
                {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div><Label>Deposited to account</Label>
              <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.bank_account_id ?? ""} onChange={(e) => setForm({ ...form, bank_account_id: e.target.value || null })}>
                <option value="">—</option>
                {banks.map((b) => <option key={b.id} value={b.id}>{b.tag || b.bank_name}</option>)}
              </select>
            </div>
          </div>
          <div><Label>Reference</Label><Input value={form.reference ?? ""} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
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
