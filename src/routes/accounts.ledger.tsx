import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDownLeft, ArrowUpRight, Scale, Download, Search, Landmark } from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, subMonths, startOfYear, isBefore, isAfter } from "date-fns";

export const Route = createFileRoute("/accounts/ledger")({
  head: () => ({
    meta: [
      { title: "Debit & Credit Ledger — Accounts" },
      { name: "description", content: "Track every credit and debit entry with date, type, category and running balance filters." },
      { property: "og:title", content: "Debit & Credit Ledger — Accounts" },
      { property: "og:description", content: "Track every credit and debit entry with date, type, category and running balance filters." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LedgerPage,
});

const fmtINR = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

type Entry = {
  id: string;
  date: string;
  direction: "credit" | "debit";
  source: string;
  title: string;
  category: string;
  method: string;
  amount: number;
};

const PRESETS = [
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "3m", label: "Last 3 months" },
  { key: "6m", label: "Last 6 months" },
  { key: "12m", label: "Last 12 months" },
  { key: "ytd", label: "Year to date" },
  { key: "all", label: "All time" },
  { key: "custom", label: "Custom range" },
];

function LedgerPage() {
  const [preset, setPreset] = useState("this_month");
  const [from, setFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [source, setSource] = useState("all");
  const [category, setCategory] = useState("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("date_desc");

  const applyPreset = (key: string) => {
    setPreset(key);
    const now = new Date();
    if (key === "this_month") { setFrom(format(startOfMonth(now), "yyyy-MM-dd")); setTo(format(endOfMonth(now), "yyyy-MM-dd")); }
    else if (key === "last_month") { const d = subMonths(now, 1); setFrom(format(startOfMonth(d), "yyyy-MM-dd")); setTo(format(endOfMonth(d), "yyyy-MM-dd")); }
    else if (key === "3m") { setFrom(format(startOfMonth(subMonths(now, 2)), "yyyy-MM-dd")); setTo(format(now, "yyyy-MM-dd")); }
    else if (key === "6m") { setFrom(format(startOfMonth(subMonths(now, 5)), "yyyy-MM-dd")); setTo(format(now, "yyyy-MM-dd")); }
    else if (key === "12m") { setFrom(format(startOfMonth(subMonths(now, 11)), "yyyy-MM-dd")); setTo(format(now, "yyyy-MM-dd")); }
    else if (key === "ytd") { setFrom(format(startOfYear(now), "yyyy-MM-dd")); setTo(format(now, "yyyy-MM-dd")); }
    else if (key === "all") { setFrom("2000-01-01"); setTo(format(now, "yyyy-MM-dd")); }
  };

  const q1 = useQuery({ queryKey: ["led_inv_pay"], queryFn: async () => (await supabase.from("accounts_invoice_payments").select("*")).data ?? [] });
  const q2 = useQuery({ queryKey: ["led_inv"], queryFn: async () => (await supabase.from("accounts_invoices").select("id,client,invoice_number,category")).data ?? [] });
  const q3 = useQuery({ queryKey: ["led_income"], queryFn: async () => (await supabase.from("accounts_manual_income").select("*")).data ?? [] });
  const q4 = useQuery({ queryKey: ["led_exp"], queryFn: async () => (await supabase.from("accounts_expenses").select("*")).data ?? [] });
  const q5 = useQuery({ queryKey: ["led_rec_pay"], queryFn: async () => (await supabase.from("accounts_recurring_expense_payments").select("*")).data ?? [] });
  const q6 = useQuery({ queryKey: ["led_rec"], queryFn: async () => (await supabase.from("accounts_recurring_expenses").select("id,title,category")).data ?? [] });
  const q7 = useQuery({ queryKey: ["led_inv_est"], queryFn: async () => (await supabase.from("accounts_investments").select("*")).data ?? [] });

  const loading = [q1, q2, q3, q4, q5, q6, q7].some((x) => x.isLoading);

  const allEntries = useMemo<Entry[]>(() => {
    const invMap = new Map((q2.data ?? []).map((i: any) => [i.id, i]));
    const recMap = new Map((q6.data ?? []).map((r: any) => [r.id, r]));
    const out: Entry[] = [];

    (q1.data ?? []).forEach((p: any) => {
      const inv: any = invMap.get(p.invoice_id);
      out.push({
        id: "ip_" + p.id, date: p.paid_on, direction: "credit", source: "Invoice payment",
        title: inv ? `${inv.invoice_number ?? "Invoice"} · ${inv.client}` : "Invoice payment",
        category: inv?.category || "Invoice", method: p.method || "—", amount: Number(p.amount || 0),
      });
    });
    (q3.data ?? []).forEach((m: any) => {
      out.push({
        id: "mi_" + m.id, date: m.received_on, direction: "credit", source: "Manual income",
        title: m.title + (m.payer ? ` · ${m.payer}` : ""), category: m.category || "Uncategorised",
        method: m.payment_method || "—", amount: Number(m.amount || 0),
      });
    });
    (q4.data ?? []).forEach((e: any) => {
      out.push({
        id: "ex_" + e.id, date: e.spent_on, direction: "debit", source: "Expense",
        title: e.title + (e.vendor ? ` · ${e.vendor}` : ""), category: e.category || "Uncategorised",
        method: e.payment_method || "—", amount: Number(e.amount || 0),
      });
    });
    (q5.data ?? []).forEach((p: any) => {
      const rec: any = recMap.get(p.recurring_expense_id);
      out.push({
        id: "rp_" + p.id, date: p.paid_on, direction: "debit", source: "Recurring expense",
        title: rec?.title || "Recurring expense", category: rec?.category || "Recurring",
        method: p.method || "—", amount: Number(p.amount || 0),
      });
    });
    (q7.data ?? []).forEach((i: any) => {
      out.push({
        id: "iv_" + i.id, date: i.invested_on, direction: "debit", source: "Investment",
        title: i.title, category: i.category || "Investment",
        method: i.payment_method || "—", amount: Number(i.amount || 0),
      });
    });
    return out.filter((e) => !!e.date);
  }, [q1.data, q2.data, q3.data, q4.data, q5.data, q6.data, q7.data]);

  const sources = useMemo(() => Array.from(new Set(allEntries.map((e) => e.source))).sort(), [allEntries]);
  const categories = useMemo(() => Array.from(new Set(allEntries.map((e) => e.category))).sort(), [allEntries]);

  // Cash at bank = all-time money in − all-time money out (never affected by filters)
  const cashAtBank = useMemo(() => allEntries.reduce((s, e) => s + (e.direction === "credit" ? e.amount : -e.amount), 0), [allEntries]);

  const entries = useMemo(() => {
    const f = parseISO(from);
    const t = parseISO(to);
    let list = allEntries.filter((e) => {
      const d = parseISO(e.date);
      if (isBefore(d, f) || isAfter(d, t)) return false;
      if (source !== "all" && e.source !== source) return false;
      if (category !== "all" && e.category !== category) return false;
      if (q.trim() && !(`${e.title} ${e.category} ${e.source} ${e.method}`.toLowerCase().includes(q.trim().toLowerCase()))) return false;
      return true;
    });
    const cmp = (a: Entry, b: Entry) => {
      if (sort === "date_asc") return a.date.localeCompare(b.date);
      if (sort === "amount_desc") return b.amount - a.amount;
      if (sort === "amount_asc") return a.amount - b.amount;
      return b.date.localeCompare(a.date);
    };
    return list.sort(cmp);
  }, [allEntries, from, to, source, category, q, sort]);

  const creditEntries = useMemo(() => entries.filter((e) => e.direction === "credit"), [entries]);
  const debitEntries = useMemo(() => entries.filter((e) => e.direction === "debit"), [entries]);
  const moneyIn = creditEntries.reduce((s, e) => s + e.amount, 0);
  const moneyOut = debitEntries.reduce((s, e) => s + e.amount, 0);
  const net = moneyIn - moneyOut;

  const breakdown = (list: Entry[]) => {
    const m = new Map<string, number>();
    list.forEach((e) => m.set(e.source, (m.get(e.source) ?? 0) + e.amount));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  };

  const exportCsv = () => {
    const rows = [["Date", "Type", "Source", "Description", "Category", "Method", "Credit", "Debit"]];
    [...entries].sort((a, b) => a.date.localeCompare(b.date)).forEach((e) => rows.push([
      e.date, e.direction === "credit" ? "Credit" : "Debit", e.source, e.title, e.category, e.method,
      e.direction === "credit" ? String(e.amount) : "", e.direction === "debit" ? String(e.amount) : "",
    ]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = `ledger-${from}-to-${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Debit &amp; Credit Dashboard</h1>
          <p className="text-xs text-muted-foreground">Money in and money out, auto-synced from invoice payments, income, expenses and investments.</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!entries.length}>
          <Download className="mr-1.5 h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryTile label="Total money in" value={moneyIn} sub={`${creditEntries.length} credit entries`} tone="credit" icon={<ArrowDownLeft className="h-4 w-4" />} />
        <SummaryTile label="Total money out" value={moneyOut} sub={`${debitEntries.length} debit entries`} tone="debit" icon={<ArrowUpRight className="h-4 w-4" />} />
        <SummaryTile label="Net balance" value={net} sub="Money in − money out" tone={net >= 0 ? "net" : "warn"} icon={<Scale className="h-4 w-4" />} />
        <SummaryTile label="Cash at bank" value={cashAtBank} sub="All-time in − all-time out" tone="bank" icon={<Landmark className="h-4 w-4" />} />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <span className="text-[11px] font-medium uppercase text-muted-foreground">Period</span>
            <Select value={preset} onValueChange={applyPreset}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{PRESETS.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-medium uppercase text-muted-foreground">From</span>
            <Input type="date" className="h-9" value={from} onChange={(e) => { setFrom(e.target.value); setPreset("custom"); }} />
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-medium uppercase text-muted-foreground">To</span>
            <Input type="date" className="h-9" value={to} onChange={(e) => { setTo(e.target.value); setPreset("custom"); }} />
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-medium uppercase text-muted-foreground">Source</span>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {sources.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-medium uppercase text-muted-foreground">Category</span>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-medium uppercase text-muted-foreground">Sort &amp; search</span>
            <div className="flex gap-2">
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="h-9 w-[42%]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="date_desc">Newest</SelectItem>
                  <SelectItem value="date_asc">Oldest</SelectItem>
                  <SelectItem value="amount_desc">High → low</SelectItem>
                  <SelectItem value="amount_asc">Low → high</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="h-9 pl-8" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two sections */}
      <div className="grid gap-4 xl:grid-cols-2">
        <LedgerSection
          title="Credit — Money In"
          hint="Invoice payments received and manually added income"
          tone="credit"
          total={moneyIn}
          entries={creditEntries}
          breakdown={breakdown(creditEntries)}
          loading={loading}
        />
        <LedgerSection
          title="Debit — Money Out"
          hint="Expenses, recurring payments and investments"
          tone="debit"
          total={moneyOut}
          entries={debitEntries}
          breakdown={breakdown(debitEntries)}
          loading={loading}
        />
      </div>
    </div>
  );
}

function SummaryTile({ label, value, sub, tone, icon }: { label: string; value: number; sub: string; tone: "credit" | "debit" | "net" | "warn" | "bank"; icon: React.ReactNode }) {
  const styles: Record<string, { bg: string; text: string }> = {
    credit: { bg: "from-emerald-500/15 to-emerald-500/5", text: "text-emerald-600 dark:text-emerald-400" },
    debit: { bg: "from-red-500/15 to-red-500/5", text: "text-red-600 dark:text-red-400" },
    net: { bg: "from-sky-500/15 to-sky-500/5", text: "text-sky-600 dark:text-sky-400" },
    warn: { bg: "from-amber-500/15 to-amber-500/5", text: "text-amber-600 dark:text-amber-400" },
    bank: { bg: "from-violet-500/15 to-violet-500/5", text: "text-violet-600 dark:text-violet-400" },
  };
  const s = styles[tone];
  return (
    <Card className={`overflow-hidden border-border/60 bg-gradient-to-br ${s.bg}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <span className="truncate">{label}</span>
          <span className={s.text}>{icon}</span>
        </div>
        <div className={`mt-1 text-xl font-bold ${s.text}`}>{fmtINR(value)}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}

function LedgerSection({ title, hint, tone, total, entries, breakdown, loading }: {
  title: string; hint: string; tone: "credit" | "debit"; total: number;
  entries: (Entry & { balance?: number })[]; breakdown: [string, number][]; loading: boolean;
}) {
  const accent = tone === "credit" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400";
  const bar = tone === "credit" ? "bg-emerald-500" : "bg-red-500";
  const sign = tone === "credit" ? "+" : "−";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-1 border-b border-border/60 bg-muted/30 pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{entries.length}</Badge>
            <span className={`text-base font-bold ${accent}`}>{fmtINR(total)}</span>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </CardHeader>

      {/* Source breakdown */}
      {breakdown.length > 0 && (
        <div className="space-y-2 border-b border-border/60 p-4">
          {breakdown.map(([src, amt]) => (
            <div key={src} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">{src}</span>
                <span className="font-medium">{fmtINR(amt)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full ${bar}`} style={{ width: `${total ? Math.max(2, (amt / total) * 100) : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <CardContent className="max-h-[520px] overflow-y-auto p-0">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No entries for these filters</div>
        ) : (
          <div className="divide-y">
            {entries.map((e) => (
              <div key={e.id} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-muted/30">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{e.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span>{format(parseISO(e.date), "dd MMM yyyy")}</span>
                    <span>·</span>
                    <span>{e.source}</span>
                    <Badge variant="secondary" className="text-[10px]">{e.category}</Badge>
                    {e.method !== "—" && <span>· {e.method}</span>}
                  </div>
                </div>
                <div className={`shrink-0 text-sm font-semibold ${accent}`}>{sign}{fmtINR(e.amount)}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
