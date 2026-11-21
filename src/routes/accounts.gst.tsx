import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Landmark, Plus, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { GST_COLLECTION_CAP, gstWalletRows, splitGst, isTaxInvoice } from "@/lib/gst";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/accounts/gst")({
  component: GstPage,
  head: () => ({ meta: [
    { title: "GST Collected | Works Accounts" },
    { name: "description", content: "All GST collected on invoices with company, date and totals against the collection limit." },
    { property: "og:title", content: "GST Collected | Works Accounts" },
    { property: "og:description", content: "All GST collected on invoices with company, date and totals against the collection limit." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
const MODE: Record<string, string> = { inclusive: "Includes GST", additional: "Additional GST" };

function GstPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("wallet");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const q = useQuery({
    queryKey: ["accounts_gst_invoices"],
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
    queryFn: async () => {
      const [invoices, payments, income] = await Promise.all([
        supabase.from("accounts_invoices").select("id, client, invoice_number, issue_date, amount, tax, total, gst_mode, status, currency, invoice_type"),
        supabase.from("accounts_invoice_payments").select("id, invoice_id, amount, gst_applicable, paid_on, reference"),
        supabase.from("accounts_manual_income").select("id, title, payer, amount, gst_applicable, received_on, reference"),
      ]);
      for (const result of [invoices, payments, income]) if (result.error) throw result.error;
      return { invoices: invoices.data ?? [], payments: payments.data ?? [], income: income.data ?? [] };
    },
  });
  const rows = useMemo(() => q.data ? gstWalletRows(q.data.invoices, q.data.payments, q.data.income) : [], [q.data]);
  const candidates = useMemo(() => {
    if (!q.data) return [];
    const invoices = new Map(q.data.invoices.map(i => [i.id, i]));
    return [
      ...q.data.payments.flatMap(p => {
        const i = invoices.get(p.invoice_id);
        if (!i || !isTaxInvoice(i) || p.gst_applicable || i.gst_mode !== "none" || i.status === "cancelled") return [];
        return [{ key: `payment:${p.id}`, id: p.id, kind: "payment" as const, company: i.client, reference: i.invoice_number ?? p.reference ?? "—", date: p.paid_on, ...splitGst(Number(p.amount), true) }];
      }),
      ...q.data.income.filter(p => !p.gst_applicable).map(p => ({ key: `income:${p.id}`, id: p.id, kind: "income" as const, company: p.payer || p.title, reference: p.reference || "Other income", date: p.received_on, ...splitGst(Number(p.amount), true) })),
    ].sort((a, b) => b.date.localeCompare(a.date));
  }, [q.data]);
  const matches = (company: string, reference: string) => `${company} ${reference}`.toLowerCase().includes(search.trim().toLowerCase());
  const filtered = rows.filter(r => matches(r.company, r.reference));
  const previous = candidates.filter(r => matches(r.company, r.reference));
  const chosen = candidates.filter(r => selected.has(r.key));
  const addPrevious = useMutation({
    mutationFn: async () => {
      for (const kind of ["payment", "income"] as const) {
        const ids = chosen.filter(r => r.kind === kind).map(r => r.id);
        for (let start = 0; start < ids.length; start += 200) {
          const { data, error } = await supabase.from(kind === "payment" ? "accounts_invoice_payments" : "accounts_manual_income")
            .update({ gst_applicable: true }).in("id", ids.slice(start, start + 200)).select("id");
          if (error) throw error;
          if (data.length !== ids.slice(start, start + 200).length) throw new Error("Some payments could not be updated. Please refresh and try again.");
        }
      }
    },
    onSuccess: () => { setSelected(new Set()); setTab("wallet"); toast.success("Previous GST bills added"); },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => { void qc.invalidateQueries(); },
  });
  const totalGst = rows.reduce((s, r) => s + r.gst, 0);
  const totalBase = rows.reduce((s, r) => s + r.base, 0);
  const totalAll = rows.reduce((s, r) => s + Number(r.total), 0);
  const pct = Math.min(100, (totalGst / GST_COLLECTION_CAP) * 100);
  const left = Math.max(0, GST_COLLECTION_CAP - totalGst);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold"><Landmark className="h-4 w-4 text-primary" />GST collection limit</div>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="text-2xl font-bold">{money(totalGst)} <span className="text-base font-normal text-muted-foreground">/ {money(GST_COLLECTION_CAP)}</span></div>
          <div className="text-sm text-muted-foreground">{money(left)} left · {pct.toFixed(1)}% used</div>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full transition-all", pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-amber-500" : "bg-primary")} style={{ width: `${pct}%` }} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-sm">
          <Stat label="Service amount (excl. GST)" value={money(totalBase)} />
          <Stat label="GST collected" value={money(totalGst)} />
          <Stat label="Total billed (incl. GST)" value={money(totalAll)} />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="wallet">GST wallet</TabsTrigger>
          <TabsTrigger value="previous">Add previous GST bills</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Search company or invoice #" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {tab === "previous" && <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">{chosen.length} selected · GST {money(chosen.reduce((s, r) => s + r.gst, 0))}</div>
        <Button onClick={() => addPrevious.mutate()} disabled={!chosen.length || addPrevious.isPending || q.isFetching}>
          {addPrevious.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add selected GST bills
        </Button>
      </div>}
      {tab === "previous" ? <div className="rounded-lg border overflow-x-auto"><table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr>
          <th className="p-3"><Checkbox aria-label="Select all visible previous payments" disabled={addPrevious.isPending || !previous.length} checked={previous.length > 0 && previous.every(r => selected.has(r.key))} onCheckedChange={value => setSelected(old => { const next = new Set(old); previous.forEach(r => value ? next.add(r.key) : next.delete(r.key)); return next; })} /></th>
          <th className="p-3">Date</th><th className="p-3">Company / Payer</th><th className="p-3">Bill / Reference</th><th className="p-3 text-right">Payment (incl. GST)</th><th className="p-3 text-right">Service amount</th><th className="p-3 text-right">GST 18%</th>
        </tr></thead><tbody>
          {q.isLoading && <tr><td colSpan={7} className="p-6 text-center">Loading payments…</td></tr>}
          {q.error && <tr><td colSpan={7} className="p-6 text-center text-destructive">Couldn’t load previous payments.</td></tr>}
          {!q.isLoading && !q.error && !previous.length && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No previous payments available.</td></tr>}
          {previous.map(r => <tr key={r.key} className="border-t">
            <td className="p-3"><Checkbox aria-label={`Includes GST: ${r.company} ${r.reference}`} disabled={addPrevious.isPending} checked={selected.has(r.key)} onCheckedChange={value => setSelected(old => { const next = new Set(old); value ? next.add(r.key) : next.delete(r.key); return next; })} /></td>
            <td className="p-3 whitespace-nowrap">{format(new Date(r.date), "dd MMM yyyy")}</td><td className="p-3 font-medium">{r.company}</td><td className="p-3">{r.reference}</td>
            <td className="p-3 text-right whitespace-nowrap">{money(r.total)}</td><td className="p-3 text-right whitespace-nowrap">{money(r.base)}</td><td className="p-3 text-right whitespace-nowrap font-semibold">{money(r.gst)}</td>
          </tr>)}
        </tbody></table></div> : <div className="rounded-xl border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr><th className="p-3">Date</th><th className="p-3">Company</th><th className="p-3">Invoice #</th><th className="p-3">Type</th><th className="p-3 text-right">Service amount</th><th className="p-3 text-right">GST</th><th className="p-3 text-right">Total</th></tr>
          </thead>
          <tbody>
            {q.isLoading && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Loading…</td></tr>}
            {q.error && <tr><td colSpan={7} className="p-6 text-center text-destructive">Couldn't load GST records.</td></tr>}
            {!q.isLoading && !q.error && !filtered.length && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No GST bills found.</td></tr>}
            {filtered.map(r => (
              <tr key={r.id} className="border-t">
                <td className="p-3 whitespace-nowrap">{format(new Date(r.date), "dd MMM yyyy")}</td>
                <td className="p-3 font-medium">{r.company}</td>
                <td className="p-3 whitespace-nowrap">{r.reference}</td>
                <td className="p-3 whitespace-nowrap">{MODE[r.mode] ?? r.mode}</td>
                <td className="p-3 text-right whitespace-nowrap">{money(r.base)}</td>
                <td className="p-3 text-right whitespace-nowrap font-semibold">{money(r.gst)}</td>
                <td className="p-3 text-right whitespace-nowrap">{money(Number(r.total))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="font-semibold">{value}</div></div>;
}
