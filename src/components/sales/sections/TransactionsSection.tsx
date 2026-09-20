import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, FlaskConical, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { csvDownload, filterPayments, inr, num, usePayments } from "@/lib/sales";
import { EmptyState, SectionCard, useSalesFilters } from "@/components/sales/SalesUI";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


const STATUS_LABEL: Record<string, string> = {
  captured: "Successful",
  authorized: "Pending",
  failed: "Failed",
  refunded: "Refunded",
  partially_refunded: "Partially Refunded",
};

const PAGE = 25;

export function TransactionsSection() {
  const f = useSalesFilters();
  const { data: payments = [], isLoading } = usePayments();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("recent");
  const [testMode, setTestMode] = useState<"exclude" | "include" | "only">("exclude");
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const markTest = useMutation({
    mutationFn: async ({ id, is_test }: { id: string; is_test: boolean }) => {
      const { error } = await supabase.from("sales_payments").update({ is_test }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.is_test ? "Marked as test payment — excluded from all numbers" : "Restored as a real payment");
      qc.invalidateQueries({ queryKey: ["sales"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(() => {
    let r = filterPayments(payments, { ...f.filters, includeTest: true });
    if (testMode === "exclude") r = r.filter((p) => !p.is_test);
    if (testMode === "only") r = r.filter((p) => !!p.is_test);
    if (status !== "all") r = r.filter((p) => p.status === status);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      r = r.filter((p) => [p.customer_name, p.customer_email, p.customer_phone, p.product_name,
        p.razorpay_payment_id, p.razorpay_order_id, p.utm_campaign, p.coupon_code]
        .some((v) => (v ?? "").toLowerCase().includes(s)));
    }
    r = [...r].sort((a, b) => {
      if (sort === "amount_desc") return b.final_amount - a.final_amount;
      if (sort === "amount_asc") return a.final_amount - b.final_amount;
      if (sort === "oldest") return +new Date(a.paid_at) - +new Date(b.paid_at);
      return +new Date(b.paid_at) - +new Date(a.paid_at);
    });
    return r;
  }, [payments, f.filters, status, q, sort, testMode]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const view = rows.slice((page - 1) * PAGE, page * PAGE);

  const exportCsv = () => csvDownload(`transactions-${f.from}-to-${f.to}.csv`, rows.map((p) => ({
    Date: new Date(p.paid_at).toLocaleString(),
    "Payment ID": p.razorpay_payment_id,
    "Order ID": p.razorpay_order_id ?? "",
    Customer: p.customer_name ?? "",
    Email: p.customer_email ?? "",
    Phone: p.customer_phone ?? "",
    Course: p.product_name ?? "",
    Amount: p.final_amount,
    Discount: p.discount,
    Tax: p.tax,
    "Gateway fee": p.gateway_fee,
    Method: p.payment_method ?? "",
    Status: STATUS_LABEL[p.status] ?? p.status,
    "Refund amount": p.refund_amount,
    Coupon: p.coupon_code ?? "",
    "UTM source": p.utm_source ?? "",
    "UTM campaign": p.utm_campaign ?? "",
  })));

  return (
    <div className="space-y-4">
      <SectionCard
        title="Live transactions"
        subtitle={`${num(rows.length)} transactions in range`}
        action={
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}>
            <Download className="mr-1.5 h-3.5 w-3.5" />Export CSV
          </Button>
        }
      >
        <div className="mb-3 flex flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search customer, course, payment ID…"
              value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="captured">Successful</SelectItem>
              <SelectItem value="authorized">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
              <SelectItem value="partially_refunded">Partially refunded</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="amount_desc">Amount: high → low</SelectItem>
              <SelectItem value="amount_asc">Amount: low → high</SelectItem>
            </SelectContent>
          </Select>
          <Select value={testMode} onValueChange={(v) => { setTestMode(v as typeof testMode); setPage(1); }}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="exclude">Real payments only</SelectItem>
              <SelectItem value="include">Include test payments</SelectItem>
              <SelectItem value="only">Test payments only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/60" />)}
          </div>
        ) : view.length === 0 ? (
          <EmptyState title="No transactions found"
            hint="Successful Razorpay payments appear here automatically once the webhook is configured." />
        ) : (
          <>
            <div className="-mx-4 overflow-x-auto px-4">
              <table className="w-full min-w-[1020px] text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">Date &amp; time</th><th className="py-2 pr-3">Course / product</th>
                    <th className="py-2 pr-3">Customer</th><th className="py-2 pr-3">Method</th>
                    <th className="py-2 pr-3">Campaign</th><th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3 text-right">Refund</th><th className="py-2 pr-3 text-right">Amount</th>
                    <th className="py-2 text-right">Test</th>
                  </tr>
                </thead>
                <tbody>
                  {view.map((p) => (
                    <tr key={p.id} className={`border-b border-border/40 transition-colors last:border-0 hover:bg-muted/40 ${p.is_test ? "opacity-60" : ""}`}>
                      <td className="py-2.5 pr-3 whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(p.paid_at).toLocaleString()}
                      </td>
                      <td className="py-2.5 pr-3 font-medium">{p.product_name ?? "—"}</td>
                      <td className="py-2.5 pr-3">
                        <div className="text-sm">{p.customer_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{p.customer_email ?? p.customer_phone ?? ""}</div>
                      </td>
                      <td className="py-2.5 pr-3 text-xs capitalize">{p.payment_method ?? "—"}</td>
                      <td className="py-2.5 pr-3 text-xs">{p.utm_campaign ?? "—"}</td>
                      <td className="py-2.5 pr-3">
                        <Badge variant={p.status === "failed" ? "destructive" : p.status === "captured" ? "secondary" : "outline"}
                          className="text-[10px]">{STATUS_LABEL[p.status] ?? p.status}</Badge>
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-xs">
                        {p.refund_amount > 0 ? inr(p.refund_amount) : "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">{inr(p.final_amount)}</td>
                      <td className="py-2.5 text-right">
                        <Button
                          size="sm"
                          variant={p.is_test ? "secondary" : "ghost"}
                          className="h-7 gap-1 px-2 text-[11px]"
                          disabled={markTest.isPending}
                          onClick={() => markTest.mutate({ id: p.id, is_test: !p.is_test })}
                        >
                          <FlaskConical className="h-3.5 w-3.5" />
                          {p.is_test ? "Test" : "Mark test"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>Page {page} of {pages}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                  <Button size="sm" variant="outline" disabled={page === pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </>
        )}
      </SectionCard>
    </div>
  );
}
