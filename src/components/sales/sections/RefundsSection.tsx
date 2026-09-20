import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download } from "lucide-react";
import {
  buildDaily, computeMetrics, csvDownload, inr, num, pct, useAdSpend, useCourses,
  usePayments, useRefunds, useSalesExpenses, useSalesSettings,
} from "@/lib/sales";
import { EmptyState, KpiCard, SectionCard, useSalesFilters } from "@/components/sales/SalesUI";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";


export function RefundsSection() {
  const f = useSalesFilters();
  const { data: refunds = [] } = useRefunds();
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

  const rows = useMemo(() => refunds.filter((r) => {
    const d = r.refunded_at.slice(0, 10);
    return d >= f.from && d <= f.to;
  }), [refunds, f.from, f.to]);

  const payById = useMemo(() => new Map(payments.map((p) => [p.id, p])), [payments]);

  const exportCsv = () => csvDownload(`refunds-${f.from}-to-${f.to}.csv`, rows.map((r) => ({
    Date: new Date(r.refunded_at).toLocaleString(),
    "Refund ID": r.razorpay_refund_id,
    "Payment ID": r.razorpay_payment_id ?? "",
    Course: payById.get(r.payment_id ?? "")?.product_name ?? "",
    Customer: payById.get(r.payment_id ?? "")?.customer_name ?? "",
    Amount: r.amount,
    Type: r.is_partial ? "Partial" : "Full",
  })));

  return (
    <div className="space-y-4">

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="Total refunds" value={rows.length} format={(n) => num(n)} />
        <KpiCard label="Refund amount" value={m.refunds} format={(n) => inr(n)} accent="warning" />
        <KpiCard label="Refund rate" value={m.refundRate} format={(n) => pct(n)} accent="warning" />
        <KpiCard label="Gross revenue" value={m.grossRevenue} format={(n) => inr(n)} />
        <KpiCard label="Net revenue after refunds" value={m.netRevenue} format={(n) => inr(n)} accent="primary" />
      </div>

      <SectionCard title="Refund trend" subtitle="Refunded amount by day">
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={daily} margin={{ left: -12, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => inr(v, true)} />
              <Tooltip formatter={(v: number) => inr(v)} />
              <Line type="monotone" dataKey="refunds" name="Refunds" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <SectionCard title="Refunded transactions" subtitle="Synced from Razorpay refund events"
        action={<Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}><Download className="mr-1.5 h-3.5 w-3.5" />Export</Button>}>
        {rows.length === 0 ? <EmptyState title="No refunds in this range" hint="Refunds processed in Razorpay appear here automatically and are deducted from revenue and profit." /> : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Course</th><th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Payment ID</th><th className="py-2 pr-3">Type</th><th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const p = payById.get(r.payment_id ?? "");
                  return (
                    <tr key={r.id} className="border-b border-border/40 last:border-0">
                      <td className="py-2.5 pr-3 whitespace-nowrap text-xs">{new Date(r.refunded_at).toLocaleString()}</td>
                      <td className="py-2.5 pr-3 font-medium">{p?.product_name ?? "—"}</td>
                      <td className="py-2.5 pr-3 text-xs">{p?.customer_name ?? p?.customer_email ?? "—"}</td>
                      <td className="py-2.5 pr-3 font-mono text-[11px] text-muted-foreground">{r.razorpay_payment_id ?? "—"}</td>
                      <td className="py-2.5 pr-3">
                        <Badge variant={r.is_partial ? "outline" : "destructive"} className="text-[10px]">
                          {r.is_partial ? "Partial" : "Full"}
                        </Badge>
                      </td>
                      <td className="py-2.5 text-right font-semibold tabular-nums">{inr(r.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
