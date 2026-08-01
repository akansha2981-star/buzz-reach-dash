import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDownLeft, ArrowUpRight, Scale, Download, Search } from "lucide-react";
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
  const [direction, setDirection] = useState("all");
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

  const entries = useMemo(() => {
    const f = parseISO(from);
    const t = parseISO(to);
    let list = allEntries.filter((e) => {
      const d = parseISO(e.date);
      if (isBefore(d, f) || isAfter(d, t)) return false;
      if (direction !== "all" && e.direction !== direction) return false;
      if (source !== "all" && e.source !== source) return false;
      if (category !== "all" && e.category !== category) return false;
      if (q.trim() && !(`${e.title} ${e.category} ${e.source} ${e.method}`.toLowerCase().includes(q.trim().toLowerCase()))) return false;
      return true;
    });
    list = list.sort((a, b) => {
      if (sort === "date_asc") return a.date.localeCompare(b.date);
      if (sort === "amount_desc") return b.amount - a.amount;
      if (sort === "amount_asc") return a.amount - b.amount;
      return b.date.localeCompare(a.date);
    });
    return list;
  }, [allEntries, from, to, direction, source, category, q, sort]);

  const credits = entries.filter((e) => e.direction === "credit").reduce((s, e) => s + e.amount, 0);
  const debits = entries.filter((e) => e.direction === "debit").reduce((s, e) => s + e.amount, 0);
  const net = credits - debits;

  // running balance (chronological)
  const withBalance = useMemo(() => {
    const chrono = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    let bal = 0;
    const map = new Map<string, number>();
    chrono.forEach((e) => { bal += e.direction === "credit" ? e.amount : -e.amount; map.set(e.id, bal); });
    return entries.map((e) => ({ ...e, balance: map.get(e.id) ?? 0 }));
  }, [entries]);

  const exportCsv = () => {
    const rows = [["Date", "Type", "Source", "Description", "Category", "Method", "Credit", "Debit", "Running balance"]];
    [...withBalance].reverse().forEach((e) => rows.push([
      e.date, e.direction === "credit" ? "Credit" : "Debit", e.source, e.title, e.category, e.method,
      e.direction === "credit" ? String(e.amount) : "", e.direction === "debit" ? String(e.amount) : "", String(e.balance),
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
          <h1 className="text-lg font-semibold">Debit & Credit Ledger</h1>
          <p className="text-xs text-muted-foreground">Every rupee in and out, auto-synced from invoices, income, expenses and investments.</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!entries.length}>
          <Download className="mr-1.5 h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
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
            <span className="text-[11px] font-medium uppercase text-muted-foreground">Type</span>
            <Select value={direction} onValueChange={setDirection}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Credit & Debit</SelectItem>
                <SelectItem value="credit">Credit (money in)</SelectItem>
                <SelectItem value="debit">Debit (money out)</SelectItem>
              </SelectContent>
            </Select>
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
            <span className="text-[11px] font-medium uppercase text-muted-foreground">Sort</span>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">Newest first</SelectItem>
                <SelectItem value="date_asc">Oldest first</SelectItem>
                <SelectItem value="amount_desc">Amount high → low</SelectItem>
                <SelectItem value="amount_asc">Amount low → high</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-medium uppercase text-muted-foreground">Search</span>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="h-9 pl-8" placeholder="Description, category…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="overflow-hidden border-border/60 bg-gradient-to-br from-emerald-500/15 to-emerald-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Total credit <ArrowDownLeft className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">{fmtINR(credits)}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">{entries.filter((e) => e.direction === "credit").length} entries</div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-border/60 bg-gradient-to-br from-red-500/15 to-red-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Total debit <ArrowUpRight className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
            <div className="mt-1 text-xl font-bold text-red-600 dark:text-red-400">{fmtINR(debits)}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">{entries.filter((e) => e.direction === "debit").length} entries</div>
          </CardContent>
        </Card>
        <Card className={`overflow-hidden border-border/60 bg-gradient-to-br ${net >= 0 ? "from-sky-500/15 to-sky-500/5" : "from-amber-500/15 to-amber-500/5"}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Net movement <Scale className="h-4 w-4 opacity-70" />
            </div>
            <div className={`mt-1 text-xl font-bold ${net >= 0 ? "text-sky-600 dark:text-sky-400" : "text-amber-600 dark:text-amber-400"}`}>{fmtINR(net)}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">Credit − Debit for this period</div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm">Ledger entries</CardTitle>
          <Badge variant="outline">{entries.length}</Badge>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading ledger…</div>
          ) : withBalance.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No entries for these filters</div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Date</th>
                      <th className="px-4 py-2 text-left font-medium">Description</th>
                      <th className="px-4 py-2 text-left font-medium">Source</th>
                      <th className="px-4 py-2 text-left font-medium">Category</th>
                      <th className="px-4 py-2 text-right font-medium">Credit</th>
                      <th className="px-4 py-2 text-right font-medium">Debit</th>
                      <th className="px-4 py-2 text-right font-medium">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {withBalance.map((e) => (
                      <tr key={e.id} className="hover:bg-muted/30">
                        <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">{format(parseISO(e.date), "dd MMM yyyy")}</td>
                        <td className="px-4 py-2.5">
                          <div className="font-medium">{e.title}</div>
                          <div className="text-[11px] text-muted-foreground">{e.method}</div>
                        </td>
                        <td className="px-4 py-2.5 text-xs">{e.source}</td>
                        <td className="px-4 py-2.5"><Badge variant="secondary" className="text-[11px]">{e.category}</Badge></td>
                        <td className="px-4 py-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">{e.direction === "credit" ? fmtINR(e.amount) : "—"}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-red-600 dark:text-red-400">{e.direction === "debit" ? fmtINR(e.amount) : "—"}</td>
                        <td className="px-4 py-2.5 text-right text-xs font-medium">{fmtINR(e.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile list */}
              <div className="divide-y md:hidden">
                {withBalance.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{e.title}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {format(parseISO(e.date), "dd MMM yyyy")} · {e.source} · {e.category}
                      </div>
                    </div>
                    <div className={`shrink-0 text-right text-sm font-semibold ${e.direction === "credit" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {e.direction === "credit" ? "+" : "−"}{fmtINR(e.amount)}
                      <div className="text-[10px] font-normal text-muted-foreground">Bal {fmtINR(e.balance)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
