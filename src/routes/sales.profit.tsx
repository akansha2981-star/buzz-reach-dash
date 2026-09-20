import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  buildDaily, computeMetrics, groupMetricsBy, inr, num, pct, useAdSpend, useCourses,
  usePayments, useSalesExpenses, useSalesSettings,
} from "@/lib/sales";
import { EmptyState, KpiCard, SalesFilterBar, SectionCard, useSalesFilters } from "@/components/sales/SalesUI";

export const Route = createFileRoute("/sales/profit")({
  component: ProfitPage,
  head: () => ({
    meta: [
      { title: "Profit Analytics · Live Sales Tracker" },
      { name: "description", content: "Gross and net profit breakdown by course, campaign and day." },
      { property: "og:title", content: "Profit Analytics" },
      { property: "og:description", content: "Gross and net profit breakdown by course, campaign and day." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const PIE = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#6366f1", "#ec4899", "#14b8a6", "#ef4444"];

function ProfitPage() {
  const f = useSalesFilters();
  const { data: payments = [] } = usePayments();
  const { data: adSpend = [] } = useAdSpend();
  const { data: expenses = [] } = useSalesExpenses();
  const { data: courses = [] } = useCourses();
  const { data: settings } = useSalesSettings();

  const base = { payments, adSpend, expenses, courses, settings };
  const m = useMemo(() => computeMetrics({ ...base, filters: f.filters }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payments, adSpend, expenses, courses, settings, f.filters]);
  const daily = useMemo(() => buildDaily({ ...base, filters: f.filters }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payments, adSpend, expenses, courses, settings, f.filters]);

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

  const costMix = [
    { name: "Product cost", value: m.productCost },
    { name: "Ad spend", value: m.adSpend },
    { name: "Gateway fees", value: m.gatewayFees },
    { name: "Other expenses", value: m.otherExpenses },
    { name: "Refunds", value: m.refunds },
  ].filter((x) => x.value > 0);

  return (
    <div className="space-y-4">
      <SalesFilterBar />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <KpiCard label="Gross revenue" value={m.grossRevenue} format={(n) => inr(n)} />
        <KpiCard label="Refunds" value={m.refunds} format={(n) => inr(n)} accent="warning" />
        <KpiCard label="Net revenue" value={m.netRevenue} format={(n) => inr(n)} accent="primary" />
        <KpiCard label="Product cost" value={m.productCost} format={(n) => inr(n)} />
        <KpiCard label="Gross profit" value={m.grossProfit} format={(n) => inr(n)} />
        <KpiCard label="Ad spend" value={m.adSpend} format={(n) => inr(n)} />
        <KpiCard label="Gateway fees" value={m.gatewayFees} format={(n) => inr(n)} />
        <KpiCard label="Other expenses" value={m.otherExpenses} format={(n) => inr(n)} />
        <KpiCard label="Net profit" value={m.netProfit} format={(n) => inr(n)} accent={m.netProfit >= 0 ? "success" : "danger"} />
        <KpiCard label="Profit margin" value={m.profitMargin} format={(n) => pct(n)} />
        <KpiCard label="Cost per sale" value={m.costPerSale} format={(n) => inr(n)} />
        <KpiCard label="ROI" value={m.roi} format={(n) => pct(n)} />
      </div>

      <SectionCard title="How net profit is calculated" subtitle="Selected range">
        <div className="space-y-1.5 text-sm">
          <Row label="Gross revenue" value={m.grossRevenue} />
          <Row label="− Refunds" value={-m.refunds} />
          <Row label="= Net revenue" value={m.netRevenue} strong />
          <Row label="− Direct course / product cost" value={-m.productCost} />
          <Row label="= Gross profit" value={m.grossProfit} strong />
          <Row label="− Ad spend" value={-m.adSpend} />
          <Row label="− Payment gateway fees" value={-m.gatewayFees} />
          <Row label="− Other business expenses" value={-m.otherExpenses} />
          <Row label="= Net profit" value={m.netProfit} strong highlight />
        </div>
      </SectionCard>

      <div className="grid gap-3 lg:grid-cols-2">
        <SectionCard title="Profit margin trend" subtitle="Daily margin %">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily} margin={{ left: -14, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
                <Tooltip formatter={(v: number) => pct(v)} />
                <Line type="monotone" dataKey="margin" name="Margin" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Cost distribution" subtitle="Where the money goes">
          {costMix.length === 0 ? <EmptyState title="No costs recorded in range" /> : (
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={costMix} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {costMix.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => inr(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Course-wise revenue" subtitle="Top courses by net revenue">
          {byCourse.length === 0 ? <EmptyState title="No course sales in range" /> : (
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCourse.slice(0, 8)} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => inr(v, true)} />
                  <YAxis type="category" dataKey="key" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => inr(v)} />
                  <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Campaign ROAS" subtitle="Return on ad spend per campaign">
          {byCampaign.length === 0 ? <EmptyState title="No campaign data in range" /> : (
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCampaign.slice(0, 8)} margin={{ left: -14, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="key" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `${v.toFixed(2)}x`} />
                  <Bar dataKey="roas" name="ROAS" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Profit per course" subtitle="Average selling price, cost per sale and profit per sale">
        {byCourse.length === 0 ? <EmptyState title="No course sales in range" /> : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Course</th><th className="py-2 pr-3">Sales</th>
                  <th className="py-2 pr-3">Avg selling price</th><th className="py-2 pr-3">Cost per sale</th>
                  <th className="py-2 pr-3">Net profit / sale</th><th className="py-2 pr-3">Gross profit</th>
                  <th className="py-2 pr-3">Net profit</th><th className="py-2 pr-3">Margin</th><th className="py-2">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {byCourse.map((r) => (
                  <tr key={r.key} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pr-3 font-medium">{r.key}</td>
                    <td className="py-2 pr-3 tabular-nums">{num(r.sales)}</td>
                    <td className="py-2 pr-3 tabular-nums">{inr(r.aov)}</td>
                    <td className="py-2 pr-3 tabular-nums">{inr(r.costPerSale)}</td>
                    <td className={`py-2 pr-3 font-medium tabular-nums ${r.netProfitPerSale >= 0 ? "text-emerald-600" : "text-destructive"}`}>{inr(r.netProfitPerSale)}</td>
                    <td className="py-2 pr-3 tabular-nums">{inr(r.grossProfit)}</td>
                    <td className={`py-2 pr-3 font-medium tabular-nums ${r.netProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>{inr(r.netProfit)}</td>
                    <td className="py-2 pr-3 tabular-nums">{pct(r.margin)}</td>
                    <td className="py-2 tabular-nums">{r.roas.toFixed(2)}x</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Campaign performance" subtitle="Spend, revenue and acquisition cost">
        {byCampaign.length === 0 ? <EmptyState title="No campaign data in range" /> : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Campaign</th><th className="py-2 pr-3">Spend</th><th className="py-2 pr-3">Sales</th>
                  <th className="py-2 pr-3">Revenue</th><th className="py-2 pr-3">ROAS</th><th className="py-2 pr-3">CAC</th>
                  <th className="py-2 pr-3">Cost / sale</th><th className="py-2">Net profit</th>
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
                    <td className="py-2 pr-3 tabular-nums">{inr(r.costPerSale)}</td>
                    <td className={`py-2 font-medium tabular-nums ${r.netProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>{inr(r.netProfit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function Row({ label, value, strong, highlight }: { label: string; value: number; strong?: boolean; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${highlight ? "bg-primary/5" : strong ? "bg-muted/40" : ""}`}>
      <span className={strong ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <span className={`tabular-nums ${strong ? "font-semibold" : ""} ${value < 0 ? "text-destructive" : ""}`}>{inr(value)}</span>
    </div>
  );
}
