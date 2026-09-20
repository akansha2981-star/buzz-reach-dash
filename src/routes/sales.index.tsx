import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Activity, IndianRupee, Megaphone, Percent, ShoppingCart, Target, TrendingUp, Users } from "lucide-react";
import {
  buildDaily, computeMetrics, filterAdSpend, filterPayments, groupMetricsBy, inr, num, pct,
  resolveRange, SUCCESS_STATUSES, useAdSpend, useCourses, usePayments, useSalesExpenses,
  useSalesSettings, ymd,
} from "@/lib/sales";
import {
  EmptyState, KpiCard, LiveDot, ProgressBar, SalesFilterBar, SectionCard, useSalesFilters,
} from "@/components/sales/SalesUI";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TransactionsSection } from "@/components/sales/sections/TransactionsSection";
import { AdSpendSection } from "@/components/sales/sections/AdSpendSection";
import { ProfitSection } from "@/components/sales/sections/ProfitSection";
import { ReportsSection } from "@/components/sales/sections/ReportsSection";
import { ExpensesSection } from "@/components/sales/sections/ExpensesSection";
import { RefundsSection } from "@/components/sales/sections/RefundsSection";
import { SettingsSection } from "@/components/sales/sections/SettingsSection";

export const Route = createFileRoute("/sales/")({
  component: OverviewPage,
  head: () => ({
    meta: [
      { title: "Live Sales Tracker · Works by B School Buzz" },
      { name: "description", content: "Live revenue, ad spend and profit intelligence across all course sales." },
      { property: "og:title", content: "Live Sales Tracker" },
      { property: "og:description", content: "Live revenue, ad spend and profit intelligence across all course sales." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function OverviewPage() {
  const f = useSalesFilters();
  const { data: payments = [], isLoading } = usePayments();
  const { data: adSpend = [] } = useAdSpend();
  const { data: expenses = [] } = useSalesExpenses();
  const { data: courses = [] } = useCourses();
  const { data: settings } = useSalesSettings();

  const base = { payments, adSpend, expenses, courses, settings };
  const today = ymd(new Date());
  const monthRange = resolveRange("this_month");

  const scoped = useMemo(
    () => computeMetrics({ ...base, filters: f.filters }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payments, adSpend, expenses, courses, settings, f.filters],
  );
  const todayM = useMemo(
    () => computeMetrics({ ...base, filters: { ...f.filters, from: today, to: today } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payments, adSpend, expenses, courses, settings, f.websiteId, f.courseId, today],
  );
  const yesterdayM = useMemo(() => {
    const y = resolveRange("yesterday");
    return computeMetrics({ ...base, filters: { ...f.filters, from: y.from, to: y.to } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments, adSpend, expenses, courses, settings, f.websiteId, f.courseId]);
  const monthM = useMemo(
    () => computeMetrics({ ...base, filters: { ...f.filters, from: monthRange.from, to: monthRange.to } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payments, adSpend, expenses, courses, settings, f.websiteId, f.courseId],
  );
  const allM = useMemo(
    () => computeMetrics({ ...base, filters: { ...f.filters, from: "2000-01-01", to: today } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payments, adSpend, expenses, courses, settings, f.websiteId, f.courseId],
  );

  const daily = useMemo(
    () => buildDaily({ ...base, filters: f.filters }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payments, adSpend, expenses, courses, settings, f.filters],
  );

  const byCourse = useMemo(() => groupMetricsBy({
    payments, adSpend, courses, settings, filters: f.filters,
    keyOfPayment: (p) => (p.course_id ? (courses.find((c) => c.id === p.course_id)?.name ?? "Unmapped") : (p.product_name ?? "Unmapped")),
    keyOfSpend: (a) => (a.course_id ? (courses.find((c) => c.id === a.course_id)?.name ?? null) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [payments, adSpend, courses, settings, f.filters]);

  const byCampaign = useMemo(() => groupMetricsBy({
    payments, adSpend, courses, settings, filters: f.filters,
    keyOfPayment: (p) => p.utm_campaign || null,
    keyOfSpend: (a) => a.campaign_name || null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [payments, adSpend, courses, settings, f.filters]);

  const campaignNames = useMemo(
    () => Array.from(new Set([
      ...filterAdSpend(adSpend, { from: "2000-01-01", to: today }).map((a) => a.campaign_name ?? ""),
      ...payments.map((p) => p.utm_campaign ?? ""),
    ].filter(Boolean))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [adSpend, payments],
  );

  const recent = useMemo(
    () => filterPayments(payments, f.filters).slice(0, 8),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payments, f.filters],
  );
  const lastTxn = payments.find((p) => SUCCESS_STATUSES.includes(p.status));

  const trend = (curr: number, prev: number) => (prev > 0 ? ((curr - prev) / prev) * 100 : null);
  const hasData = payments.length > 0 || adSpend.length > 0;

  return (
    <div className="space-y-4">
      <div id="sales-overview" className="scroll-mt-24" />
      <SalesFilterBar campaigns={campaignNames} />

      {!hasData && !isLoading && (
        <SectionCard title="Waiting for your first transaction" subtitle="Razorpay integration">
          <EmptyState
            title="No sales data yet"
            hint="Once the Razorpay webhook is connected in Settings, every successful payment will appear here automatically. Ad spend can be added right away."
          />
          <div className="flex justify-center gap-2">
            <Button asChild size="sm"><a href="#sales-settings">Open settings</a></Button>
            <Button asChild size="sm" variant="outline"><a href="#sales-ad-spend">Add ad spend</a></Button>
          </div>
        </SectionCard>
      )}

      {/* Live revenue hero */}
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/5 via-background to-background p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <LiveDot />
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Live revenue today</span>
          </div>
          <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-primary">{inr(todayM.netRevenue)}</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div><p className="text-muted-foreground">Sales</p><p className="font-semibold">{num(todayM.sales)}</p></div>
            <div><p className="text-muted-foreground">Profit</p><p className="font-semibold">{inr(todayM.netProfit)}</p></div>
            <div><p className="text-muted-foreground">Ad spend</p><p className="font-semibold">{inr(todayM.adSpend)}</p></div>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Last transaction: {lastTxn ? new Date(lastTxn.paid_at).toLocaleString() : "—"}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
          <KpiCard label="Today's Revenue" value={todayM.netRevenue} format={(n) => inr(n)}
            sub={`${num(todayM.sales)} sales`} trend={trend(todayM.netRevenue, yesterdayM.netRevenue)} accent="primary" icon={IndianRupee} />
          <KpiCard label="Today's Net Profit" value={todayM.netProfit} format={(n) => inr(n)}
            trend={trend(todayM.netProfit, yesterdayM.netProfit)}
            accent={todayM.netProfit >= 0 ? "success" : "danger"} icon={TrendingUp} />
          <KpiCard label="Monthly Revenue" value={monthM.netRevenue} format={(n) => inr(n)}
            sub={`${num(monthM.sales)} sales this month`} icon={Activity} />
          <KpiCard label="Monthly Net Profit" value={monthM.netProfit} format={(n) => inr(n)}
            sub={`Margin ${pct(monthM.profitMargin)}`} accent={monthM.netProfit >= 0 ? "success" : "danger"} icon={Percent} />
        </div>
      </div>

      {/* Scoped KPI grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <KpiCard label="Net Revenue" value={scoped.netRevenue} format={(n) => inr(n)} sub="selected range" icon={IndianRupee} />
        <KpiCard label="Ad Spend" value={scoped.adSpend} format={(n) => inr(n)} icon={Megaphone} />
        <KpiCard label="Gross Profit" value={scoped.grossProfit} format={(n) => inr(n)} />
        <KpiCard label="Net Profit" value={scoped.netProfit} format={(n) => inr(n)}
          accent={scoped.netProfit >= 0 ? "success" : "danger"} />
        <KpiCard label="Total Sales" value={scoped.sales} format={(n) => num(n)} icon={ShoppingCart} />
        <KpiCard label="Profit Margin" value={scoped.profitMargin} format={(n) => pct(n)} />
        <KpiCard label="ROAS" value={scoped.roas} format={(n) => `${n.toFixed(2)}x`} />
        <KpiCard label="ROI" value={scoped.roi} format={(n) => pct(n)} />
        <KpiCard label="CAC" value={scoped.cac} format={(n) => inr(n)} icon={Users} />
        <KpiCard label="AOV" value={scoped.aov} format={(n) => inr(n)} />
        <KpiCard label="Refunds" value={scoped.refunds} format={(n) => inr(n)} sub={pct(scoped.refundRate)} accent="warning" />
        <KpiCard label="Overall Revenue" value={allM.netRevenue} format={(n) => inr(n)} sub="all time" />
      </div>

      {/* Targets */}
      {settings && (settings.daily_revenue_target > 0 || settings.monthly_revenue_target > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          <SectionCard title="Today's targets" subtitle="Daily goals">
            <div className="space-y-3">
              <TargetRow label="Revenue" value={todayM.netRevenue} target={settings.daily_revenue_target} fmt={inr} />
              <TargetRow label="Net profit" value={todayM.netProfit} target={settings.daily_profit_target} fmt={inr} />
              <TargetRow label="Sales" value={todayM.sales} target={settings.daily_sales_target} fmt={(n) => num(n)} />
              <TargetRow label="Ad spend limit" value={todayM.adSpend} target={settings.daily_ad_spend_limit} fmt={inr} invert />
            </div>
          </SectionCard>
          <SectionCard title="Monthly target" subtitle="Month to date">
            <div className="space-y-3">
              <TargetRow label="Revenue" value={monthM.netRevenue} target={settings.monthly_revenue_target} fmt={inr} />
              <TargetRow label="Net profit" value={monthM.netProfit} target={settings.monthly_profit_target} fmt={inr} />
            </div>
          </SectionCard>
        </div>
      )}

      {/* Revenue vs ad spend */}
      <SectionCard title="Revenue vs Ad Spend" subtitle="Net revenue, ad spend and profit by day">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={daily} margin={{ left: -12, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => inr(v, true)} />
              <Tooltip content={<DayTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="revenue" name="Net revenue" stroke="hsl(var(--primary))" fill="url(#gRev)" strokeWidth={2} />
              <Area type="monotone" dataKey="adSpend" name="Ad spend" stroke="hsl(var(--destructive))" fill="transparent" strokeWidth={2} />
              <Area type="monotone" dataKey="netProfit" name="Net profit" stroke="#10b981" fill="transparent" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <div className="grid gap-3 lg:grid-cols-2">
        <SectionCard title="Daily profit" subtitle="Green = profit, red = loss">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} margin={{ left: -12, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => inr(v, true)} />
                <Tooltip content={<DayTooltip />} />
                <Bar dataKey="netProfit" name="Net profit" radius={[4, 4, 0, 0]}>
                  {daily.map((d) => (
                    <Cell key={d.date} fill={d.netProfit >= 0 ? "#10b981" : "hsl(var(--destructive))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Sales volume & AOV" subtitle="Daily orders against average order value">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily} margin={{ left: -12, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
                <YAxis yAxisId="l" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v: number) => inr(v, true)} />
                <Tooltip content={<DayTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="l" type="monotone" dataKey="sales" name="Sales" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line yAxisId="r" type="monotone" dataKey="aov" name="AOV" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      {/* Course performance */}
      <SectionCard title="Course performance" subtitle="Revenue, cost and profitability per course"
        action={<Button asChild size="sm" variant="outline"><a href="#sales-profit">Full analytics</a></Button>}>
        {byCourse.length === 0 ? <EmptyState title="No course sales in this range" /> : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Course</th><th className="py-2 pr-3">Sales</th><th className="py-2 pr-3">Revenue</th>
                  <th className="py-2 pr-3">Ad spend</th><th className="py-2 pr-3">Product cost</th>
                  <th className="py-2 pr-3">Gross profit</th><th className="py-2 pr-3">Net profit</th>
                  <th className="py-2 pr-3">Margin</th><th className="py-2 pr-3">ROAS</th><th className="py-2">AOV</th>
                </tr>
              </thead>
              <tbody>
                {byCourse.map((r) => (
                  <tr key={r.key} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pr-3 font-medium">{r.key}</td>
                    <td className="py-2 pr-3 tabular-nums">{num(r.sales)}</td>
                    <td className="py-2 pr-3 tabular-nums">{inr(r.revenue)}</td>
                    <td className="py-2 pr-3 tabular-nums">{inr(r.adSpend)}</td>
                    <td className="py-2 pr-3 tabular-nums">{inr(r.productCost)}</td>
                    <td className="py-2 pr-3 tabular-nums">{inr(r.grossProfit)}</td>
                    <td className={`py-2 pr-3 font-medium tabular-nums ${r.netProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>{inr(r.netProfit)}</td>
                    <td className="py-2 pr-3 tabular-nums">{pct(r.margin)}</td>
                    <td className="py-2 pr-3 tabular-nums">{r.roas.toFixed(2)}x</td>
                    <td className="py-2 tabular-nums">{inr(r.aov)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Campaign performance */}
      <SectionCard title="Campaign performance" subtitle="Matched on campaign name and UTM campaign">
        {byCampaign.length === 0 ? (
          <EmptyState title="No campaign data yet" hint="Add ad spend with a campaign name, and tag payment links with utm_campaign to see ROAS per campaign." />
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Campaign</th><th className="py-2 pr-3">Spend</th><th className="py-2 pr-3">Sales</th>
                  <th className="py-2 pr-3">Revenue</th><th className="py-2 pr-3">ROAS</th>
                  <th className="py-2 pr-3">CAC</th><th className="py-2">Net profit</th>
                </tr>
              </thead>
              <tbody>
                {byCampaign.map((r) => (
                  <tr key={r.key} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pr-3 font-medium">{r.key}</td>
                    <td className="py-2 pr-3 tabular-nums">{inr(r.adSpend)}</td>
                    <td className="py-2 pr-3 tabular-nums">{num(r.sales)}</td>
                    <td className="py-2 pr-3 tabular-nums">{inr(r.revenue)}</td>
                    <td className="py-2 pr-3 tabular-nums">{r.roas.toFixed(2)}x</td>
                    <td className="py-2 pr-3 tabular-nums">{inr(r.cac)}</td>
                    <td className={`py-2 font-medium tabular-nums ${r.netProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>{inr(r.netProfit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Recent transactions */}
      <SectionCard title="Live transactions" subtitle="Most recent payments in range"
        action={<Button asChild size="sm" variant="outline"><a href="#sales-transactions">View all</a></Button>}>
        {recent.length === 0 ? <EmptyState title="No transactions in this range" /> : (
          <ul className="divide-y divide-border/50">
            {recent.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.product_name ?? "Payment"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.customer_name ?? p.customer_email ?? "Customer"} · {new Date(p.paid_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={p.status === "failed" ? "destructive" : p.status === "captured" ? "secondary" : "outline"}
                    className="text-[10px] capitalize">{p.status.replace("_", " ")}</Badge>
                  <span className="text-sm font-semibold tabular-nums">{inr(p.final_amount)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Business health" subtitle="All time">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Health label="Revenue" value={inr(allM.netRevenue)} />
          <Health label="Gross profit" value={inr(allM.grossProfit)} />
          <Health label="Net profit" value={inr(allM.netProfit)} />
          <Health label="Profit margin" value={pct(allM.profitMargin)} />
          <Health label="Ad spend" value={inr(allM.adSpend)} />
          <Health label="ROAS" value={`${allM.roas.toFixed(2)}x`} />
          <Health label="CAC" value={inr(allM.cac)} />
          <Health label="AOV" value={inr(allM.aov)} />
          <Health label="Total orders" value={num(allM.orders)} />
          <Health label="Refund rate" value={pct(allM.refundRate)} />
        </div>
      </SectionCard>

      <SectionAnchor id="sales-transactions" title="Live transactions" />
      <TransactionsSection />

      <SectionAnchor id="sales-ad-spend" title="Ad spend" />
      <AdSpendSection />

      <SectionAnchor id="sales-profit" title="Profit analytics" />
      <ProfitSection />

      <SectionAnchor id="sales-reports" title="Reports & profit calendar" />
      <ReportsSection />

      <SectionAnchor id="sales-expenses" title="Other expenses" />
      <ExpensesSection />

      <SectionAnchor id="sales-refunds" title="Refunds" />
      <RefundsSection />

      <SectionAnchor id="sales-settings" title="Settings & integration" />
      <SettingsSection />
    </div>
  );
}

function SectionAnchor({ id, title }: { id: string; title: string }) {
  return (
    <div id={id} className="scroll-mt-24 pt-2">
      <div className="flex items-center gap-3">
        <h2 className="font-display text-lg font-semibold sm:text-xl">{title}</h2>
        <span className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
      </div>
    </div>
  );
}

function Health({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function TargetRow({
  label, value, target, fmt, invert,
}: { label: string; value: number; target: number; fmt: (n: number) => string; invert?: boolean }) {
  if (!target) return null;
  const p = (value / target) * 100;
  const tone = invert ? (p > 100 ? "danger" : "warning") : p >= 100 ? "success" : "primary";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-medium"><Target className="h-3.5 w-3.5 text-muted-foreground" />{label}</span>
        <span className="tabular-nums text-muted-foreground">{fmt(value)} / {fmt(target)} · {pct(p, 0)}</span>
      </div>
      <ProgressBar value={p} tone={tone as "primary" | "success" | "warning" | "danger"} />
    </div>
  );
}

function DayTooltip({ active, payload, label }: { active?: boolean; payload?: { payload: Record<string, number> }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-border/60 bg-background/95 p-3 text-xs shadow-lg backdrop-blur">
      <p className="mb-1 font-semibold">{label}</p>
      <p>Revenue: <span className="tabular-nums">{inr(d.revenue)}</span></p>
      <p>Ad spend: <span className="tabular-nums">{inr(d.adSpend)}</span></p>
      <p>Gross profit: <span className="tabular-nums">{inr(d.grossProfit)}</span></p>
      <p>Net profit: <span className="tabular-nums">{inr(d.netProfit)}</span></p>
      <p>Sales: <span className="tabular-nums">{num(d.sales)}</span></p>
    </div>
  );
}
