import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Landmark } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { GST_COLLECTION_CAP } from "@/lib/gst";
import { cn } from "@/lib/utils";

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
  const [search, setSearch] = useState("");
  const q = useQuery({
    queryKey: ["accounts_gst_invoices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts_invoices")
        .select("id, client, invoice_number, issue_date, amount, tax, total, gst_mode, status, currency")
        .neq("gst_mode", "none").neq("status", "cancelled").order("issue_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const rows = q.data ?? [];
  const filtered = useMemo(() => rows.filter(r => `${r.client} ${r.invoice_number ?? ""}`.toLowerCase().includes(search.trim().toLowerCase())), [rows, search]);
  const totalGst = rows.reduce((s, r) => s + Number(r.tax), 0);
  const totalBase = rows.reduce((s, r) => s + Number(r.amount), 0);
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

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Search company or invoice #" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr><th className="p-3">Date</th><th className="p-3">Company</th><th className="p-3">Invoice #</th><th className="p-3">Type</th><th className="p-3 text-right">Service amount</th><th className="p-3 text-right">GST</th><th className="p-3 text-right">Total</th></tr>
          </thead>
          <tbody>
            {q.isLoading && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Loading…</td></tr>}
            {q.error && <tr><td colSpan={7} className="p-6 text-center text-destructive">Couldn't load GST records.</td></tr>}
            {!q.isLoading && !filtered.length && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No GST invoices yet. Choose "Includes GST" or "Additional GST" when creating an invoice.</td></tr>}
            {filtered.map(r => (
              <tr key={r.id} className="border-t">
                <td className="p-3 whitespace-nowrap">{format(new Date(r.issue_date), "dd MMM yyyy")}</td>
                <td className="p-3 font-medium">{r.client}</td>
                <td className="p-3 whitespace-nowrap">{r.invoice_number ?? "—"}</td>
                <td className="p-3 whitespace-nowrap">{MODE[r.gst_mode] ?? r.gst_mode}</td>
                <td className="p-3 text-right whitespace-nowrap">{money(Number(r.amount))}</td>
                <td className="p-3 text-right whitespace-nowrap font-semibold">{money(Number(r.tax))}</td>
                <td className="p-3 text-right whitespace-nowrap">{money(Number(r.total))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="font-semibold">{value}</div></div>;
}
