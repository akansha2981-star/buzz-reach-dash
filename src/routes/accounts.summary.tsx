import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, Wallet, FileText, Receipt, Repeat,
  AlertTriangle, CheckCircle2, Clock, IndianRupee,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Legend, PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { format, startOfMonth, endOfMonth, subMonths, parseISO, isAfter, isBefore, differenceInDays } from "date-fns";

export const Route = createFileRoute("/accounts/summary")({ component: SummaryPage });

const RANGES = [
  { key: "3m", label: "Last 3 months", months: 3 },
  { key: "6m", label: "Last 6 months", months: 6 },
  { key: "12m", label: "Last 12 months", months: 12 },
  { key: "ytd", label: "Year to date", months: 0 },
  { key: "all", label: "All time", months: 999 },
];

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

const fmtINR = (n: number) =>
  "₹" + Math.round(n).toLocaleString("en-IN");

function SummaryPage() {
  const [range, setRange] = useState("6m");
  const [category, setCategory] = useState<string>("all");

  const rangeStart = useMemo(() => {
    const r = RANGES.find((x) => x.key === range)!;
    if (r.key === "ytd") return new Date(new Date().getFullYear(), 0, 1);
    if (r.key === "all") return new Date(2000, 0, 1);
    return startOfMonth(subMonths(new Date(), r.months - 1));
  }, [range]);

  const { data: invoices = [] } = useQuery({
    queryKey: ["sum_invoices"],
    queryFn: async () => (await supabase.from("accounts_invoices").select("*")).data ?? [],
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["sum_invoice_payments"],
    queryFn: async () => (await supabase.from("accounts_invoice_payments").select("*")).data ?? [],
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ["sum_expenses"],
    queryFn: async () => (await supabase.from("accounts_expenses").select("*")).data ?? [],
  });
  const { data: recurring = [] } = useQuery({
    queryKey: ["sum_recurring"],
    queryFn: async () => (await supabase.from("accounts_recurring_expenses").select("*")).data ?? [],
  });
  const { data: recPayments = [] } = useQuery({
    queryKey: ["sum_rec_payments"],
    queryFn: async () => (await supabase.from("accounts_recurring_expense_payments").select("*")).data ?? [],
  });
  const { data: investments = [] } = useQuery({
    queryKey: ["sum_investments"],
    queryFn: async () => (await supabase.from("accounts_investments").select("*")).data ?? [],
  });


  const inRange = (d: string | null) => (d ? isAfter(parseISO(d), rangeStart) || parseISO(d).getTime() === rangeStart.getTime() : false);

  const filteredInvoices = useMemo(
    () => invoices.filter((i: any) => inRange(i.issue_date) && (category === "all" || i.category === category)),
    // eslint-disable-next-line
    [invoices, rangeStart, category]
  );
  const filteredPayments = useMemo(() => {
    const invIds = new Set(filteredInvoices.map((i: any) => i.id));
    return payments.filter((p: any) => invIds.has(p.invoice_id) && inRange(p.paid_on));
  }, [payments, filteredInvoices]);
  const filteredExpenses = useMemo(
    () => expenses.filter((e: any) => inRange(e.spent_on) && (category === "all" || e.category === category)),
    // eslint-disable-next-line
    [expenses, rangeStart, category]
  );
  const filteredRecPay = useMemo(
    () => recPayments.filter((p: any) => inRange(p.paid_on)),
    // eslint-disable-next-line
    [recPayments, rangeStart]
  );

  const totalBilled = filteredInvoices.reduce((s: number, i: any) => s + Number(i.total || 0), 0);
  const totalCollected = filteredPayments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
  const totalOutstanding = totalBilled - totalCollected;
  const totalInvoices = filteredInvoices.length;
  const paidInvoices = filteredInvoices.filter((i: any) => i.status === "paid").length;
  const pendingInvoices = filteredInvoices.filter((i: any) => i.status !== "paid" && i.status !== "cancelled").length;

  const today = new Date();
  const delayedInvoices = filteredInvoices.filter((i: any) => {
    if (!i.due_date || i.status === "paid" || i.status === "cancelled") return false;
    return isBefore(parseISO(i.due_date), today);
  });
  const delayedAmount = delayedInvoices.reduce((s: number, i: any) => {
    const paid = payments.filter((p: any) => p.invoice_id === i.id).reduce((a: number, p: any) => a + Number(p.amount || 0), 0);
    return s + Math.max(0, Number(i.total || 0) - paid);
  }, 0);

  const expensesOneTime = filteredExpenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  const expensesRecurring = filteredRecPay.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
  const totalExpenses = expensesOneTime + expensesRecurring;

  const salaryExpenses = [
    ...filteredExpenses.filter((e: any) => (e.category || "").toLowerCase() === "salaries" || (e.category || "").toLowerCase() === "salary"),
  ].reduce((s: number, e: any) => s + Number(e.amount || 0), 0)
   + filteredRecPay
     .filter((p: any) => {
       const rec = recurring.find((r: any) => r.id === p.recurring_expense_id);
       return rec && ((rec.category || "").toLowerCase() === "salaries" || (rec.category || "").toLowerCase() === "salary");
     })
     .reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

  const officeExpenses = filteredExpenses
    .filter((e: any) => ["Rent", "Utilities", "Office"].includes(e.category))
    .reduce((s: number, e: any) => s + Number(e.amount || 0), 0)
    + filteredRecPay
      .filter((p: any) => {
        const rec = recurring.find((r: any) => r.id === p.recurring_expense_id);
        return rec && ["Rent", "Utilities", "Office"].includes(rec.category || "");
      })
      .reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

  const netProfit = totalCollected - totalExpenses;

  // Investments (range-filtered + all-time for bank balance)
  const filteredInvestments = useMemo(
    () => investments.filter((i: any) => inRange(i.invested_on) && (category === "all" || i.category === category)),
    // eslint-disable-next-line
    [investments, rangeStart, category]
  );
  const totalInvestment = filteredInvestments.reduce((s: number, i: any) => s + Number(i.amount || 0), 0);

  // All-time cash position: money received − money spent − money invested
  const allTimeReceived = payments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
  const allTimeExpenses =
    expenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0) +
    recPayments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
  const allTimeInvestment = investments.reduce((s: number, i: any) => s + Number(i.amount || 0), 0);
  const bankBalance = allTimeReceived - allTimeExpenses - allTimeInvestment;


  // Monthly time-series
  const months = useMemo(() => {
    const arr: { key: string; label: string; start: Date; end: Date }[] = [];
    const monthCount = range === "ytd" ? new Date().getMonth() + 1 : range === "all" ? 12 : RANGES.find((r) => r.key === range)!.months;
    for (let i = monthCount - 1; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      arr.push({ key: format(d, "yyyy-MM"), label: format(d, "MMM yy"), start: startOfMonth(d), end: endOfMonth(d) });
    }
    return arr;
  }, [range]);

  const monthSeries = months.map((m) => {
    const billed = invoices
      .filter((i: any) => i.issue_date && !isBefore(parseISO(i.issue_date), m.start) && !isAfter(parseISO(i.issue_date), m.end))
      .reduce((s: number, i: any) => s + Number(i.total || 0), 0);
    const collected = payments
      .filter((p: any) => p.paid_on && !isBefore(parseISO(p.paid_on), m.start) && !isAfter(parseISO(p.paid_on), m.end))
      .reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    const exp = expenses
      .filter((e: any) => e.spent_on && !isBefore(parseISO(e.spent_on), m.start) && !isAfter(parseISO(e.spent_on), m.end))
      .reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
    const rec = recPayments
      .filter((p: any) => p.paid_on && !isBefore(parseISO(p.paid_on), m.start) && !isAfter(parseISO(p.paid_on), m.end))
      .reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    return {
      month: m.label,
      Billed: Math.round(billed),
      Collected: Math.round(collected),
      Expenses: Math.round(exp + rec),
      Profit: Math.round(collected - exp - rec),
    };
  });

  const monthAvgRevenue = monthSeries.length ? monthSeries.reduce((s, m) => s + m.Collected, 0) / monthSeries.length : 0;
  const monthAvgExpense = monthSeries.length ? monthSeries.reduce((s, m) => s + m.Expenses, 0) / monthSeries.length : 0;

  // Expense by category
  const expenseCatMap = new Map<string, number>();
  filteredExpenses.forEach((e: any) => {
    const c = e.category || "Uncategorised";
    expenseCatMap.set(c, (expenseCatMap.get(c) || 0) + Number(e.amount || 0));
  });
  filteredRecPay.forEach((p: any) => {
    const rec = recurring.find((r: any) => r.id === p.recurring_expense_id);
    const c = rec?.category || "Recurring";
    expenseCatMap.set(c, (expenseCatMap.get(c) || 0) + Number(p.amount || 0));
  });
  const expenseByCat = Array.from(expenseCatMap.entries())
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value);

  // Invoice status pie
  const statusCount = new Map<string, number>();
  filteredInvoices.forEach((i: any) => {
    const s = i.status || "draft";
    statusCount.set(s, (statusCount.get(s) || 0) + 1);
  });
  const statusData = Array.from(statusCount.entries()).map(([name, value]) => ({ name, value }));

  const activeRecurringMonthly = recurring
    .filter((r: any) => r.is_active && r.frequency === "monthly")
    .reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

  // Category dropdown options (union of used)
  const categoryOptions = useMemo(() => {
    const s = new Set<string>();
    invoices.forEach((i: any) => i.category && s.add(i.category));
    expenses.forEach((e: any) => e.category && s.add(e.category));
    return Array.from(s).sort();
  }, [invoices, expenses]);

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Range</span>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>{RANGES.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Category</span>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categoryOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Badge variant="outline" className="ml-auto">Since {format(rangeStart, "dd MMM yyyy")}</Badge>
      </div>

      {/* Headline position — all-time, auto-synced */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={TrendingUp} label="Total money received" value={fmtINR(allTimeReceived)} tone="emerald" sub="All-time collections" />
        <Kpi icon={TrendingDown} label="Total expenses" value={fmtINR(allTimeExpenses)} tone="red" sub="One-time + recurring paid" />
        <Kpi icon={PiggyBank} label="Total investment" value={fmtINR(allTimeInvestment)} tone="violet" sub={`${investments.length} entries`} />
        <Kpi icon={Landmark} label="Balance in bank" value={fmtINR(bankBalance)} tone={bankBalance >= 0 ? "sky" : "red"} sub="Received − expenses − investment" />
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">

        <Kpi icon={Wallet} label="Net profit" value={fmtINR(netProfit)} tone={netProfit >= 0 ? "emerald" : "red"} sub={`Avg/mo ${fmtINR(monthAvgRevenue - monthAvgExpense)}`} />
        <Kpi icon={TrendingUp} label="Total collected" value={fmtINR(totalCollected)} tone="emerald" sub={`Avg/mo ${fmtINR(monthAvgRevenue)}`} />
        <Kpi icon={TrendingDown} label="Total expenses" value={fmtINR(totalExpenses)} tone="amber" sub={`Avg/mo ${fmtINR(monthAvgExpense)}`} />
        <Kpi icon={Clock} label="Payment pending" value={fmtINR(totalOutstanding)} tone="indigo" sub={`${pendingInvoices} invoices`} />
        <Kpi icon={FileText} label="Total invoices" value={totalInvoices.toString()} sub={`${paidInvoices} paid`} />
        <Kpi icon={CheckCircle2} label="Invoices paid" value={paidInvoices.toString()} tone="emerald" sub={`${totalInvoices ? Math.round((paidInvoices / totalInvoices) * 100) : 0}% completion`} />
        <Kpi icon={AlertTriangle} label="Delayed payment" value={fmtINR(delayedAmount)} tone="red" sub={`${delayedInvoices.length} overdue`} />
        <Kpi icon={Repeat} label="Recurring / month" value={fmtINR(activeRecurringMonthly)} tone="violet" sub={`${recurring.filter((r: any) => r.is_active).length} active`} />
        <Kpi icon={IndianRupee} label="Salaries paid" value={fmtINR(salaryExpenses)} tone="rose" />
        <Kpi icon={Receipt} label="Office expenses" value={fmtINR(officeExpenses)} tone="sky" />
        <Kpi icon={Receipt} label="One-time expenses" value={fmtINR(expensesOneTime)} />
        <Kpi icon={Repeat} label="Recurring paid" value={fmtINR(expensesRecurring)} tone="amber" />
      </div>

      {/* Cumulative area */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Cash flow · Revenue vs Expenses</CardTitle></CardHeader>
        <CardContent className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthSeries}>
              <defs>
                <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.5} /><stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmtINR(v)} />
              <Legend />
              <Area type="monotone" dataKey="Collected" stroke="#10b981" fill="url(#gRev)" strokeWidth={2} />
              <Area type="monotone" dataKey="Expenses" stroke="#ef4444" fill="url(#gExp)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Billed vs Collected</CardTitle></CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthSeries}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmtINR(v)} />
                <Legend />
                <Bar dataKey="Billed" fill="#6366f1" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Collected" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Net profit trend</CardTitle></CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthSeries}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmtINR(v)} />
                <Line type="monotone" dataKey="Profit" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Expenses by category</CardTitle></CardHeader>
          <CardContent className="h-[280px]">
            {expenseByCat.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No expenses in this range</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={expenseByCat} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={3}>
                    {expenseByCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmtINR(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Invoice status</CardTitle></CardHeader>
          <CardContent className="h-[280px]">
            {statusData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No invoices</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={3}>
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delayed payments list */}
      {delayedInvoices.length > 0 && (
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-500" /> Delayed payments</CardTitle>
            <Badge variant="destructive">{delayedInvoices.length}</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {delayedInvoices.slice(0, 8).map((i: any) => {
                const paid = payments.filter((p: any) => p.invoice_id === i.id).reduce((a: number, p: any) => a + Number(p.amount || 0), 0);
                const due = Number(i.total || 0) - paid;
                const daysLate = differenceInDays(today, parseISO(i.due_date));
                return (
                  <div key={i.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{i.invoice_number} · {i.client}</div>
                      <div className="text-xs text-muted-foreground">Due {format(parseISO(i.due_date), "dd MMM yyyy")} · {daysLate}d late</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-red-600">{fmtINR(due)}</div>
                      <div className="text-xs text-muted-foreground">of {fmtINR(Number(i.total))}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Kpi({
  icon: Icon, label, value, sub, tone,
}: { icon: any; label: string; value: string; sub?: string; tone?: string }) {
  const toneMap: Record<string, string> = {
    emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400",
    red: "from-red-500/15 to-red-500/5 text-red-600 dark:text-red-400",
    amber: "from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400",
    indigo: "from-indigo-500/15 to-indigo-500/5 text-indigo-600 dark:text-indigo-400",
    violet: "from-violet-500/15 to-violet-500/5 text-violet-600 dark:text-violet-400",
    rose: "from-rose-500/15 to-rose-500/5 text-rose-600 dark:text-rose-400",
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
