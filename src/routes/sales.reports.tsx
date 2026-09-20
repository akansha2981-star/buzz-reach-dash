import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download } from "lucide-react";
import {
  buildDaily, computeMetrics, csvDownload, inr, num, pct, useAdSpend, useCourses,
  usePayments, useSalesExpenses, useSalesSettings, ymd,
} from "@/lib/sales";
import { EmptyState, KpiCard, SalesFilterBar, SectionCard, useSalesFilters } from "@/components/sales/SalesUI";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sales/reports")({
  component: ReportsPage,
  head: () => ({
    meta: [
      { title: "Daily & Monthly Reports · Live Sales Tracker" },
      { name: "description", content: "Day-by-day and month-by-month revenue, ad spend and profit reporting." },
      { property: "og:title", content: "Sales Reports" },
      { property: "og:description", content: "Day-by-day and month-by-month revenue, ad spend and profit reporting." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function ReportsPage() {
  const f = useSalesFilters();
  const [tab, setTab] = useState<"daily" | "monthly" | "calendar">("daily");
  const { data: payments = [] } = usePayments();
  const { data: adSpend = [] } = useAdSpend();
  const { data: expenses = [] } = useSalesExpenses();
  const { data: courses = [] } = useCourses();
  const { data: settings } = useSalesSettings();

  const base = { payments, adSpend, expenses, courses, settings };
  const daily = useMemo(() => buildDaily({ ...base, filters: f.filters }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payments, adSpend, expenses, courses, settings, f.filters]);

  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const from = ymd(d);
      const to = ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0));
      const m = computeMetrics({ ...base, filters: { ...f.filters, from, to } });
      return { label: d.toLocaleString("en-IN", { month: "short", year: "2-digit" }), from, to, ...m };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments, adSpend, expenses, courses, settings, f.websiteId, f.courseId]);

  const thisMonth = months[months.length - 1];
  const prevMonth = months[months.length - 2];
  const delta = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : null);

  const exportDaily = () => csvDownload(`daily-report-${f.from}-to-${f.to}.csv`, daily.map((d) => ({
    Date: d.date, Sales: d.sales, Revenue: Math.round(d.revenue), "Ad spend": Math.round(d.adSpend),
    "Gateway charges": Math.round(d.gatewayFees), "Product cost": Math.round(d.productCost),
    "Other expenses": Math.round(d.otherExpenses), "Gross profit": Math.round(d.grossProfit),
    "Net profit": Math.round(d.netProfit), "Margin %": d.margin.toFixed(1),
    ROAS: d.roas.toFixed(2), CAC: Math.round(d.cac), AOV: Math.round(d.aov), Refunds: Math.round(d.refunds),
  })));

  const exportMonthly = () => csvDownload("monthly-report.csv", months.map((m) => ({
    Month: m.label, Sales: m.sales, Revenue: Math.round(m.netRevenue), "Ad spend": Math.round(m.adSpend),
    "Gross profit": Math.round(m.grossProfit), "Net profit": Math.round(m.netProfit),
    "Margin %": m.profitMargin.toFixed(1), ROAS: m.roas.toFixed(2), ROI: m.roi.toFixed(1),
    CAC: Math.round(m.cac), AOV: Math.round(m.aov), "Refund rate %": m.refundRate.toFixed(1),
  })));

  const monthDays = useMemo(() => daily.slice(-42), [daily]);
  const maxProfit = Math.max(1, ...monthDays.map((d) => Math.abs(d.netProfit)));

  return (
    <div className="space-y-4">
      <SalesFilterBar />

      <div className="flex gap-1 rounded-xl border border-border/60 bg-background/80 p-1 shadow-sm">
        {(["daily", "monthly", "calendar"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn(
            "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-all",
            tab === t ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted",
          )}>{t === "calendar" ? "Profit calendar" : `${t} report`}</button>
        ))}
      </div>

      {tab === "daily" && (
        <SectionCard title="Daily report" subtitle={`${daily.length} days in range`}
          action={<Button size="sm" variant="outline" onClick={exportDaily}><Download className="mr-1.5 h-3.5 w-3.5" />Export</Button>}>
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[1040px] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Sales</th><th className="py-2 pr-3">Revenue</th>
                  <th className="py-2 pr-3">Ad spend</th><th className="py-2 pr-3">Gateway</th><th className="py-2 pr-3">Product cost</th>
                  <th className="py-2 pr-3">Gross profit</th><th className="py-2 pr-3">Net profit</th><th className="py-2 pr-3">Margin</th>
                  <th className="py-2 pr-3">ROAS</th><th className="py-2 pr-3">CAC</th><th className="py-2 pr-3">AOV</th><th className="py-2">Refunds</th>
                </tr>
              </thead>
              <tbody>
                {daily.map((d) => (
                  <tr key={d.date} className="border-b border-border/40 last:border-0">
                    <td className="py-2 pr-3 whitespace-nowrap text-xs">{d.date}</td>
                    <td className="py-2 pr-3 tabular-nums">{num(d.sales)}</td>
                    <td className="py-2 pr-3 tabular-nums">{inr(d.revenue)}</td>
                    <td className="py-2 pr-3 tabular-nums">{inr(d.adSpend)}</td>
                    <td className="py-2 pr-3 tabular-nums">{inr(d.gatewayFees)}</td>
                    <td className="py-2 pr-3 tabular-nums">{inr(d.productCost)}</td>
                    <td className="py-2 pr-3 tabular-nums">{inr(d.grossProfit)}</td>
                    <td className={`py-2 pr-3 font-medium tabular-nums ${d.netProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>{inr(d.netProfit)}</td>
                    <td className="py-2 pr-3 tabular-nums">{pct(d.margin)}</td>
                    <td className="py-2 pr-3 tabular-nums">{d.roas.toFixed(2)}x</td>
                    <td className="py-2 pr-3 tabular-nums">{inr(d.cac)}</td>
                    <td className="py-2 pr-3 tabular-nums">{inr(d.aov)}</td>
                    <td className="py-2 tabular-nums">{inr(d.refunds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {tab === "monthly" && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            <KpiCard label="Revenue (this month)" value={thisMonth?.netRevenue ?? 0} format={(n) => inr(n)}
              trend={delta(thisMonth?.netRevenue ?? 0, prevMonth?.netRevenue ?? 0)} accent="primary" />
            <KpiCard label="Sales" value={thisMonth?.sales ?? 0} format={(n) => num(n)}
              trend={delta(thisMonth?.sales ?? 0, prevMonth?.sales ?? 0)} />
            <KpiCard label="Ad spend" value={thisMonth?.adSpend ?? 0} format={(n) => inr(n)}
              trend={delta(thisMonth?.adSpend ?? 0, prevMonth?.adSpend ?? 0)} />
            <KpiCard label="Gross profit" value={thisMonth?.grossProfit ?? 0} format={(n) => inr(n)}
              trend={delta(thisMonth?.grossProfit ?? 0, prevMonth?.grossProfit ?? 0)} />
            <KpiCard label="Net profit" value={thisMonth?.netProfit ?? 0} format={(n) => inr(n)}
              trend={delta(thisMonth?.netProfit ?? 0, prevMonth?.netProfit ?? 0)}
              accent={(thisMonth?.netProfit ?? 0) >= 0 ? "success" : "danger"} />
            <KpiCard label="Refund rate" value={thisMonth?.refundRate ?? 0} format={(n) => pct(n)} accent="warning" />
          </div>

          <SectionCard title="Monthly business performance" subtitle="Last 12 months"
            action={<Button size="sm" variant="outline" onClick={exportMonthly}><Download className="mr-1.5 h-3.5 w-3.5" />Export</Button>}>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={months} margin={{ left: -12, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => inr(v, true)} />
                  <Tooltip formatter={(v: number) => inr(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="netRevenue" name="Revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="adSpend" name="Ad spend" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="netProfit" name="Net profit" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="-mx-4 mt-4 overflow-x-auto px-4">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">Month</th><th className="py-2 pr-3">Sales</th><th className="py-2 pr-3">Revenue</th>
                    <th className="py-2 pr-3">Ad spend</th><th className="py-2 pr-3">Gross profit</th><th className="py-2 pr-3">Net profit</th>
                    <th className="py-2 pr-3">Margin</th><th className="py-2 pr-3">ROAS</th><th className="py-2 pr-3">ROI</th>
                    <th className="py-2 pr-3">CAC</th><th className="py-2 pr-3">AOV</th><th className="py-2">Refund rate</th>
                  </tr>
                </thead>
                <tbody>
                  {[...months].reverse().map((m) => (
                    <tr key={m.from} className="border-b border-border/40 last:border-0">
                      <td className="py-2 pr-3 font-medium">{m.label}</td>
                      <td className="py-2 pr-3 tabular-nums">{num(m.sales)}</td>
                      <td className="py-2 pr-3 tabular-nums">{inr(m.netRevenue)}</td>
                      <td className="py-2 pr-3 tabular-nums">{inr(m.adSpend)}</td>
                      <td className="py-2 pr-3 tabular-nums">{inr(m.grossProfit)}</td>
                      <td className={`py-2 pr-3 font-medium tabular-nums ${m.netProfit >= 0 ? "text-emerald-600" : "text-destructive"}`}>{inr(m.netProfit)}</td>
                      <td className="py-2 pr-3 tabular-nums">{pct(m.profitMargin)}</td>
                      <td className="py-2 pr-3 tabular-nums">{m.roas.toFixed(2)}x</td>
                      <td className="py-2 pr-3 tabular-nums">{pct(m.roi)}</td>
                      <td className="py-2 pr-3 tabular-nums">{inr(m.cac)}</td>
                      <td className="py-2 pr-3 tabular-nums">{inr(m.aov)}</td>
                      <td className="py-2 tabular-nums">{pct(m.refundRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}

      {tab === "calendar" && (
        <SectionCard title="Profit calendar" subtitle="Revenue, sales, ad spend and profit per day">
          {monthDays.length === 0 ? <EmptyState title="No days in range" /> : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {monthDays.map((d) => {
                const intensity = Math.min(1, Math.abs(d.netProfit) / maxProfit);
                const loss = d.netProfit < 0;
                return (
                  <div key={d.date} className="rounded-xl border border-border/60 p-2.5"
                    style={{
                      backgroundColor: d.revenue === 0 && d.adSpend === 0
                        ? "transparent"
                        : loss ? `rgba(239,68,68,${0.06 + intensity * 0.18})` : `rgba(16,185,129,${0.06 + intensity * 0.18})`,
                    }}>
                    <p className="text-[11px] font-semibold">{new Date(`${d.date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Rev <span className="tabular-nums text-foreground">{inr(d.revenue, true)}</span></p>
                    <p className="text-[11px] text-muted-foreground">Ads <span className="tabular-nums text-foreground">{inr(d.adSpend, true)}</span></p>
                    <p className={`text-[11px] font-medium tabular-nums ${loss ? "text-destructive" : "text-emerald-700"}`}>
                      {inr(d.netProfit, true)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{num(d.sales)} sales</p>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}
