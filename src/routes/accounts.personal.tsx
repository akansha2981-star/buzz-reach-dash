import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, UserRound, Wallet, CalendarDays, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format, parseISO, startOfMonth, endOfMonth, isSameMonth } from "date-fns";

export const Route = createFileRoute("/accounts/personal")({
  head: () => ({
    meta: [
      { title: "Personal Expenses — Accounts" },
      { name: "description", content: "Log personal, non-business spending separately and keep it out of business expense totals." },
      { property: "og:title", content: "Personal Expenses — Accounts" },
      { property: "og:description", content: "Log personal, non-business spending separately and keep it out of business expense totals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PersonalExpensesPage,
});

type PersonalExpense = {
  id: string;
  title: string;
  category: string | null;
  amount: number;
  currency: string;
  spent_on: string;
  payment_method: string | null;
  bank_account_id: string | null;
  notes: string | null;
};

const CATEGORIES = [
  "Family", "Food & Dining", "Shopping", "Travel", "Health", "Rent & Home",
  "Education", "Entertainment", "Bills", "Gifts", "Other",
];

const CAT_TONE: Record<string, string> = {
  Family: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  "Food & Dining": "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  Shopping: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400",
  Travel: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  Health: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  "Rent & Home": "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  Education: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  Entertainment: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  Bills: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  Gifts: "bg-pink-500/15 text-pink-600 dark:text-pink-400",
  Other: "bg-muted text-muted-foreground",
};

const fmtINR = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

function PersonalExpensesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PersonalExpense | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [month, setMonth] = useState("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["accounts_personal_expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts_personal_expenses")
        .select("*")
        .order("spent_on", { ascending: false });
      if (error) throw error;
      return data as PersonalExpense[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("accounts_personal_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Personal expense deleted");
      qc.invalidateQueries({ queryKey: ["accounts_personal_expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const monthOptions = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => r.spent_on && s.add(r.spent_on.slice(0, 7)));
    return Array.from(s).sort().reverse();
  }, [rows]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (filter !== "all" && r.category !== filter) return false;
        if (month !== "all" && r.spent_on.slice(0, 7) !== month) return false;
        if (q.trim() && !`${r.title} ${r.category ?? ""} ${r.payment_method ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())) return false;
        return true;
      }),
    [rows, filter, month, q]
  );

  const allTime = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const rangeTotal = filtered.reduce((s, r) => s + Number(r.amount || 0), 0);
  const thisMonth = rows
    .filter((r) => r.spent_on && isSameMonth(parseISO(r.spent_on), new Date()))
    .reduce((s, r) => s + Number(r.amount || 0), 0);

  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach((r) => m.set(r.category || "Other", (m.get(r.category || "Other") ?? 0) + Number(r.amount || 0)));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Hero */}
      <Card className="overflow-hidden border-border/60 bg-gradient-to-br from-rose-500/10 via-fuchsia-500/5 to-transparent">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-rose-500/15 p-2.5 text-rose-600 dark:text-rose-400">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Personal Expenses</h1>
              <p className="max-w-xl text-xs text-muted-foreground">
                Money you spent for personal use. These entries stay out of business expense totals, but are
                deducted from your bank balance so cash always reconciles.
              </p>
            </div>
          </div>
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="shrink-0">
            <Plus className="mr-1.5 h-4 w-4" /> Add personal expense
          </Button>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total personal spend" value={fmtINR(allTime)} tone="rose" icon={<Wallet className="h-4 w-4" />} sub={`${rows.length} entries`} />
        <Stat label="This month" value={fmtINR(thisMonth)} tone="amber" icon={<CalendarDays className="h-4 w-4" />} sub={format(new Date(), "MMMM yyyy")} />
        <Stat label="Filtered total" value={fmtINR(rangeTotal)} tone="violet" icon={<Search className="h-4 w-4" />} sub={`${filtered.length} entries`} />
        <Stat label="Avg per entry" value={fmtINR(filtered.length ? rangeTotal / filtered.length : 0)} tone="sky" icon={<UserRound className="h-4 w-4" />} sub="Within filters" />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
          <div className="space-y-1">
            <span className="text-[11px] font-medium uppercase text-muted-foreground">Category</span>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-medium uppercase text-muted-foreground">Month</span>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                {monthOptions.map((m) => (
                  <SelectItem key={m} value={m}>{format(parseISO(m + "-01"), "MMM yyyy")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-medium uppercase text-muted-foreground">Search</span>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="h-9 pl-8" placeholder="Search title, category…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/60 bg-muted/30 pb-3">
            <CardTitle className="text-sm">Entries</CardTitle>
            <span className="text-base font-bold text-rose-600 dark:text-rose-400">{fmtINR(rangeTotal)}</span>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
                <UserRound className="h-8 w-8" />
                <p className="text-sm">No personal expenses yet.</p>
              </div>
            ) : (
              <div className="divide-y">
                {filtered.map((r) => (
                  <div key={r.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{r.title}</span>
                        {r.category && (
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CAT_TONE[r.category] ?? CAT_TONE.Other}`}>
                            {r.category}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {r.spent_on && format(parseISO(r.spent_on), "dd MMM yyyy")}
                        {r.payment_method && <> · {r.payment_method}</>}
                        {r.notes && <> · {r.notes}</>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="font-semibold text-rose-600 dark:text-rose-400">− {fmtINR(Number(r.amount))}</div>
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete this personal expense?")) del.mutate(r.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Where it went</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {byCat.length === 0 ? (
              <p className="text-xs text-muted-foreground">No data for these filters.</p>
            ) : (
              byCat.map(([cat, amt]) => (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">{cat}</span>
                    <span className="font-medium">{fmtINR(amt)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-rose-500" style={{ width: `${rangeTotal ? Math.max(2, (amt / rangeTotal) * 100) : 0}%` }} />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <PersonalDialog open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  );
}

function Stat({ label, value, sub, tone, icon }: { label: string; value: string; sub?: string; tone: string; icon: React.ReactNode }) {
  const tones: Record<string, { bg: string; text: string }> = {
    rose: { bg: "from-rose-500/15 to-rose-500/5", text: "text-rose-600 dark:text-rose-400" },
    amber: { bg: "from-amber-500/15 to-amber-500/5", text: "text-amber-600 dark:text-amber-400" },
    violet: { bg: "from-violet-500/15 to-violet-500/5", text: "text-violet-600 dark:text-violet-400" },
    sky: { bg: "from-sky-500/15 to-sky-500/5", text: "text-sky-600 dark:text-sky-400" },
  };
  const s = tones[tone] ?? tones.rose;
  return (
    <Card className={`overflow-hidden border-border/60 bg-gradient-to-br ${s.bg}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <span className="truncate">{label}</span>
          <span className={s.text}>{icon}</span>
        </div>
        <div className={`mt-1 text-xl font-bold ${s.text}`}>{value}</div>
        {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function PersonalDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (o: boolean) => void; editing: PersonalExpense | null }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<PersonalExpense>>({});

  const { data: banks = [] } = useQuery({
    queryKey: ["personal_banks"],
    queryFn: async () => (await supabase.from("accounts_bank_accounts").select("id,tag,bank_name")).data ?? [],
  });

  useEffect(() => {
    if (open) {
      setForm(editing ?? { currency: "INR", spent_on: new Date().toISOString().slice(0, 10), amount: 0 });
    }
  }, [open, editing]);

  const isEdit = !!editing;
  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form };
      delete payload.id;
      if (payload.bank_account_id === "none") payload.bank_account_id = null;
      if (isEdit) {
        const { error } = await supabase.from("accounts_personal_expenses").update(payload).eq("id", editing!.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from("accounts_personal_expenses").insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Personal expense updated" : "Personal expense added");
      qc.invalidateQueries({ queryKey: ["accounts_personal_expenses"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit personal expense" : "Add personal expense"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Title *</Label>
            <Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Family dinner" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Amount</Label>
              <Input type="number" value={form.amount ?? 0} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={form.spent_on ?? ""} onChange={(e) => setForm({ ...form, spent_on: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Category</Label>
              <Select value={form.category ?? ""} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payment method</Label>
              <Input value={form.payment_method ?? ""} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} placeholder="UPI / Card / Cash" />
            </div>
          </div>
          <div>
            <Label>Paid from account</Label>
            <Select value={form.bank_account_id ?? "none"} onValueChange={(v) => setForm({ ...form, bank_account_id: v === "none" ? null : v })}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not specified</SelectItem>
                {banks.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.tag}{b.bank_name ? ` · ${b.bank_name}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!form.title || save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
