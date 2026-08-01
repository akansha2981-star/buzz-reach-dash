import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, TrendingUp, PiggyBank, Landmark, Target } from "lucide-react";
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

export const Route = createFileRoute("/accounts/investments")({ component: InvestmentsPage });

type Investment = {
  id: string;
  title: string;
  category: string | null;
  amount: number;
  currency: string;
  invested_on: string;
  payment_method: string | null;
  bank_account_id: string | null;
  expected_return: number | null;
  current_value: number | null;
  status: string;
  notes: string | null;
};

const CATEGORIES = ["Equity", "Mutual Fund", "Fixed Deposit", "Gold", "Real Estate", "Crypto", "Business", "Equipment", "Other"];
const STATUSES = ["active", "matured", "exited", "written_off"];

const fmtINR = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

function InvestmentsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Investment | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["accounts_investments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts_investments")
        .select("*")
        .order("invested_on", { ascending: false });
      if (error) throw error;
      return data as Investment[];
    },
  });

  const { data: banks = [] } = useQuery({
    queryKey: ["accounts_bank_accounts"],
    queryFn: async () => (await supabase.from("accounts_bank_accounts").select("id,tag,bank_name")).data ?? [],
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("accounts_investments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Investment deleted");
      qc.invalidateQueries({ queryKey: ["accounts_investments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = filter === "all" ? rows : rows.filter((r) => r.category === filter);

  const stats = useMemo(() => {
    const invested = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
    const active = rows.filter((r) => r.status === "active");
    const activeInvested = active.reduce((s, r) => s + Number(r.amount || 0), 0);
    const currentValue = rows.reduce((s, r) => s + Number(r.current_value ?? r.amount ?? 0), 0);
    return { invested, activeInvested, currentValue, gain: currentValue - invested };
  }, [rows]);

  const bankLabel = (id: string | null) => {
    const b: any = banks.find((x: any) => x.id === id);
    return b ? b.tag || b.bank_name : null;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={PiggyBank} label="Total invested" value={fmtINR(stats.invested)} tone="violet" />
        <Stat icon={Landmark} label="Active investments" value={fmtINR(stats.activeInvested)} tone="indigo" sub={`${rows.filter((r) => r.status === "active").length} active`} />
        <Stat icon={Target} label="Current value" value={fmtINR(stats.currentValue)} tone="sky" />
        <Stat icon={TrendingUp} label="Unrealised gain" value={fmtINR(stats.gain)} tone={stats.gain >= 0 ? "emerald" : "red"} />
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>All</Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c} active={filter === c} onClick={() => setFilter(c)}>{c}</Chip>
        ))}
        <Button className="ml-auto" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="mr-1 h-4 w-4" />Add investment
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
              <PiggyBank className="h-8 w-8" />
              <p className="text-sm">No investments recorded yet.</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((inv) => {
                const cv = inv.current_value ?? null;
                const diff = cv === null ? null : Number(cv) - Number(inv.amount);
                return (
                  <div key={inv.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{inv.title}</span>
                        {inv.category && <Badge variant="secondary">{inv.category}</Badge>}
                        <Badge variant={inv.status === "active" ? "default" : "outline"} className="capitalize">
                          {inv.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {format(new Date(inv.invested_on), "dd MMM yyyy")}
                        {inv.payment_method && <> · {inv.payment_method}</>}
                        {bankLabel(inv.bank_account_id) && <> · {bankLabel(inv.bank_account_id)}</>}
                        {inv.expected_return != null && <> · Expected {fmtINR(Number(inv.expected_return))}</>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-semibold">{fmtINR(Number(inv.amount))}</div>
                        {diff !== null && (
                          <div className={`text-xs font-medium ${diff >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            {diff >= 0 ? "+" : "−"}{fmtINR(Math.abs(diff))}
                          </div>
                        )}
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(inv); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete investment?")) del.mutate(inv.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <InvestmentDialog open={open} onOpenChange={setOpen} editing={editing} banks={banks as any[]} />
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
    red: "from-red-500/15 to-red-500/5 text-red-600 dark:text-red-400",
    indigo: "from-indigo-500/15 to-indigo-500/5 text-indigo-600 dark:text-indigo-400",
    violet: "from-violet-500/15 to-violet-500/5 text-violet-600 dark:text-violet-400",
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

function InvestmentDialog({
  open, onOpenChange, editing, banks,
}: { open: boolean; onOpenChange: (o: boolean) => void; editing: Investment | null; banks: any[] }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<Investment>>({});
  useEffect(() => {
    if (open) {
      setForm(
        editing ?? {
          currency: "INR",
          invested_on: new Date().toISOString().slice(0, 10),
          amount: 0,
          status: "active",
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
      if (payload.expected_return === "" ) payload.expected_return = null;
      if (payload.current_value === "") payload.current_value = null;
      if (isEdit) {
        const { error } = await supabase.from("accounts_investments").update(payload).eq("id", editing!.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from("accounts_investments").insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Investment updated" : "Investment added");
      qc.invalidateQueries({ queryKey: ["accounts_investments"] });
      qc.invalidateQueries({ queryKey: ["sum_investments"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{isEdit ? "Edit investment" : "Add investment"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Title *</Label><Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Amount invested</Label><Input type="number" value={form.amount ?? 0} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div>
            <div><Label>Date</Label><Input type="date" value={form.invested_on ?? ""} onChange={(e) => setForm({ ...form, invested_on: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Category</Label>
              <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">—</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><Label>Status</Label>
              <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.status ?? "active"} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Paid from account</Label>
              <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.bank_account_id ?? ""} onChange={(e) => setForm({ ...form, bank_account_id: e.target.value || null })}>
                <option value="">—</option>
                {banks.map((b) => <option key={b.id} value={b.id}>{b.tag || b.bank_name}</option>)}
              </select>
            </div>
            <div><Label>Payment method</Label><Input value={form.payment_method ?? ""} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Expected return (₹)</Label><Input type="number" value={form.expected_return ?? ""} onChange={(e) => setForm({ ...form, expected_return: e.target.value === "" ? null : Number(e.target.value) })} /></div>
            <div><Label>Current value (₹)</Label><Input type="number" value={form.current_value ?? ""} onChange={(e) => setForm({ ...form, current_value: e.target.value === "" ? null : Number(e.target.value) })} /></div>
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
