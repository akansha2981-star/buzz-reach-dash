import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Receipt, Search } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/accounts/tds")({
  component: TDSPage,
  head: () => ({ meta: [
    { title: "TDS | Works Accounts" },
    { name: "description", content: "Manage dated TDS amounts and company records in Works Accounts." },
    { property: "og:title", content: "TDS | Works Accounts" },
    { property: "og:description", content: "Manage dated TDS amounts and company records in Works Accounts." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

type TDS = Database["public"]["Tables"]["accounts_tds"]["Row"];
const money = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount);
const today = () => format(new Date(), "yyyy-MM-dd");

function TDSPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TDS | null>(null);
  const [search, setSearch] = useState("");
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [company, setCompany] = useState("");
  const [mode, setMode] = useState("manual");
  const [deleting, setDeleting] = useState<TDS | null>(null);

  const records = useQuery({
    queryKey: ["accounts_tds"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts_tds").select("*").order("tds_date", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const clients = useQuery({
    queryKey: ["accounts_tds_companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts_clients").select("name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const rows = records.data ?? [];
  const companies = [...new Set([...(clients.data ?? []).map(c => c.name), ...rows.map(r => r.company_name)])].sort((a, b) => a.localeCompare(b));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [source, setSource] = useState("all");
  const q = search.trim().toLowerCase();
  const filtered = rows.filter(row => (row.company_name.toLowerCase().includes(q) || (row.invoice_number ?? "").toLowerCase().includes(q))
    && (!from || row.tds_date >= from) && (!to || row.tds_date <= to)
    && (source === "all" || (source === "invoice" ? !!row.invoice_id : !row.invoice_id)));
  const stats = useMemo(() => {
    const sum = (list: TDS[]) => list.reduce((s, r) => s + Number(r.amount), 0);
    const now = new Date();
    const monthKey = format(now, "yyyy-MM");
    const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fyStart = `${fyStartYear}-04-01`;
    const byMonth = new Map<string, number>();
    const byCompany = new Map<string, number>();
    for (const r of filtered) {
      const k = r.tds_date.slice(0, 7);
      byMonth.set(k, (byMonth.get(k) ?? 0) + Number(r.amount));
      byCompany.set(r.company_name, (byCompany.get(r.company_name) ?? 0) + Number(r.amount));
    }
    const linked = filtered.filter(r => r.invoice_id);
    const invoiceValue = linked.reduce((s, r) => s + Number(r.invoice_total ?? 0), 0);
    return {
      total: sum(filtered), month: sum(rows.filter(r => r.tds_date.startsWith(monthKey))), fy: sum(rows.filter(r => r.tds_date >= fyStart)),
      fyLabel: `FY ${fyStartYear}-${String(fyStartYear + 1).slice(2)}`,
      bank: linked.reduce((s, r) => s + Number(r.bank_amount ?? 0), 0), invoiceValue, linkedTds: sum(linked),
      chart: [...byMonth.entries()].sort().slice(-12).map(([m, v]) => ({ month: format(new Date(`${m}-01T00:00:00`), "MMM yy"), amount: v })),
      companies: [...byCompany.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
    };
  }, [rows, filtered]);

  function start(entry: TDS | null) {
    setEditing(entry);
    setDate(entry?.tds_date ?? today());
    setAmount(entry ? String(entry.amount) : "");
    setCompany(entry?.company_name ?? "");
    setMode("manual");
    setOpen(true);
  }
  const save = useMutation({
    mutationFn: async () => {
      const numericAmount = Number(amount);
      if (!date || !company.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) throw new Error("Enter a date, company name and a TDS amount greater than zero.");
      const payload = { tds_date: date, amount: numericAmount, company_name: company.trim() };
      if (editing) {
        const { error } = await supabase.from("accounts_tds").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) throw new Error("Please sign in again to save TDS.");
        const { error } = await supabase.from("accounts_tds").insert({ ...payload, created_by: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accounts_tds"] }); setOpen(false); toast.success(editing ? "TDS updated" : "TDS added"); },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("accounts_tds").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["accounts_tds"] }); setDeleting(null); toast.success("TDS deleted"); },
    onError: (error: Error) => toast.error(error.message),
  });

  return <div className="space-y-5">
    <div className="flex items-center justify-between gap-3">
      <h1 className="text-xl font-semibold">TDS</h1>
      <Button onClick={() => start(null)}><Plus className="mr-1.5 h-4 w-4" />Add TDS</Button>
    </div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[["Total TDS (filtered)", money(stats.total), `${filtered.length} entries`], ["This month", money(stats.month), format(new Date(), "MMMM yyyy")], [stats.fyLabel, money(stats.fy), "Apr – Mar"], ["Effective TDS rate", stats.invoiceValue ? `${((stats.linkedTds / stats.invoiceValue) * 100).toFixed(2)}%` : "—", `Bank received ${money(stats.bank)}`]].map(([l, v, sub]) => (
        <div key={l} className="rounded-xl border bg-card p-4"><p className="text-xs font-medium text-muted-foreground">{l}</p><p className="mt-1 text-xl font-semibold text-primary tabular-nums">{v}</p><p className="text-xs text-muted-foreground">{sub}</p></div>
      ))}
    </div>
    {stats.invoiceValue > 0 && <div className="rounded-xl border bg-card p-4">
      <div className="flex justify-between text-xs text-muted-foreground"><span>Invoice value settled {money(stats.invoiceValue)}</span><span>Bank {money(stats.bank)} · TDS {money(stats.linkedTds)}</span></div>
      <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-muted"><div className="bg-emerald-500" style={{ width: `${(stats.bank / stats.invoiceValue) * 100}%` }} /><div className="bg-sky-500" style={{ width: `${(stats.linkedTds / stats.invoiceValue) * 100}%` }} /></div>
    </div>}
    {stats.chart.length > 0 && <div className="grid gap-3 lg:grid-cols-3">
      <div className="rounded-xl border bg-card p-4 lg:col-span-2"><p className="mb-2 text-sm font-semibold">Monthly TDS</p>
        <div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.chart}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" fontSize={11} /><YAxis fontSize={11} width={50} /><Tooltip formatter={(v: number) => money(v)} /><Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
      <div className="rounded-xl border bg-card p-4"><p className="mb-3 text-sm font-semibold">Top companies</p><div className="space-y-2.5">
        {stats.companies.map(([name, v]) => <div key={name}><div className="flex justify-between gap-2 text-xs"><span className="truncate">{name}</span><span className="font-medium tabular-nums">{money(v)}</span></div><div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${(v / (stats.companies[0]?.[1] || 1)) * 100}%` }} /></div></div>)}
      </div></div>
    </div>}
    <div className="flex flex-col gap-2 border-y border-border py-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="relative w-full sm:w-64"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search TDS" placeholder="Search company or invoice…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
      <div className="grid grid-cols-2 gap-2"><Input type="date" aria-label="From date" value={from} onChange={e => setFrom(e.target.value)} /><Input type="date" aria-label="To date" value={to} onChange={e => setTo(e.target.value)} /></div>
      <Select value={source} onValueChange={setSource}><SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All entries</SelectItem><SelectItem value="invoice">From invoices</SelectItem><SelectItem value="manual">Added manually</SelectItem></SelectContent></Select>
      {(from || to || source !== "all" || search) && <Button variant="ghost" size="sm" onClick={() => { setFrom(""); setTo(""); setSource("all"); setSearch(""); }}>Clear</Button>}
    </div>
    {records.isLoading ? <p className="py-8 text-center text-muted-foreground">Loading TDS…</p>
      : records.isError ? <div className="space-y-3 py-8 text-center"><p className="text-destructive">TDS entries could not be loaded.</p><Button variant="outline" onClick={() => records.refetch()}>Retry</Button></div>
      : filtered.length === 0 ? <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground"><Receipt className="h-8 w-8" /><p>{search ? "No matching TDS entries." : "No TDS entries yet."}</p></div>
      : <div className="divide-y divide-border">
        <div className="hidden grid-cols-[1fr_150px_160px_88px] gap-4 pb-3 text-xs font-medium text-muted-foreground sm:grid"><span>Company / invoice</span><span>Date</span><span className="text-right">TDS amount</span><span className="text-right">Actions</span></div>
        {filtered.map(row => <div key={row.id} className="grid grid-cols-[1fr_auto] items-center gap-3 py-4 sm:grid-cols-[1fr_150px_160px_88px] sm:gap-4">
          <div className="min-w-0 break-words"><div className="font-medium">{row.company_name}</div>{row.invoice_id ? <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"><Badge variant="outline" className="text-[10px]">Invoice {row.invoice_number ?? ""}</Badge>{row.invoice_total != null && <span>Total {money(Number(row.invoice_total))} · Bank {money(Number(row.bank_amount ?? 0))}</span>}</div> : <div className="text-xs text-muted-foreground">Manual entry</div>}</div>
          <div className="col-start-1 row-start-2 text-sm text-muted-foreground sm:col-auto sm:row-auto">{format(new Date(`${row.tds_date}T00:00:00`), "dd MMM yyyy")}</div>
          <div className="col-start-2 row-start-1 text-right font-semibold tabular-nums sm:col-auto sm:row-auto">{money(Number(row.amount))}</div>
          <div className="col-start-2 flex justify-end sm:col-auto"><Button size="icon" variant="ghost" aria-label={`Edit TDS for ${row.company_name}`} title="Edit TDS" onClick={() => start(row)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label={`Delete TDS for ${row.company_name}`} title="Delete TDS" onClick={() => setDeleting(row)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
        </div>)}
      </div>}

    <Dialog open={open} onOpenChange={value => { if (!save.isPending) setOpen(value); }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{editing ? "Edit TDS" : "Add TDS"}</DialogTitle><DialogDescription>Date, deducted amount and company.</DialogDescription></DialogHeader>
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="tds-date">Date</Label><Input id="tds-date" type="date" required value={date} onChange={e => setDate(e.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="tds-amount">TDS amount (₹)</Label><Input id="tds-amount" type="number" inputMode="decimal" min="0.01" step="0.01" required placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} /></div></div>
          <div className="space-y-2"><Label>Company name</Label>
            <div className="flex gap-2"><Button type="button" size="sm" variant={mode === "manual" ? "default" : "outline"} aria-pressed={mode === "manual"} onClick={() => setMode("manual")}>Enter manually</Button><Button type="button" size="sm" variant={mode === "list" ? "default" : "outline"} aria-pressed={mode === "list"} onClick={() => setMode("list")}>Select from list</Button></div>
            {mode === "manual" ? <Input aria-label="Company name" required placeholder="Enter company name" value={company} onChange={e => setCompany(e.target.value)} /> : <Select value={company || undefined} onValueChange={setCompany}><SelectTrigger aria-label="Select company"><SelectValue placeholder="Select company" /></SelectTrigger><SelectContent>{companies.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select>}
            {mode === "list" && companies.length === 0 && <p className="text-xs text-muted-foreground">No companies saved yet.</p>}
            {mode === "list" && clients.isError && <p className="text-xs text-destructive">Saved clients could not be loaded. You can still enter a company manually.</p>}
          </div>
          <DialogFooter className="gap-2"><Button type="button" variant="outline" disabled={save.isPending} onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={save.isPending || !date || !company.trim() || Number(amount) <= 0}>{save.isPending ? "Saving…" : "Save TDS"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <Dialog open={!!deleting} onOpenChange={value => { if (!value && !remove.isPending) setDeleting(null); }}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Delete TDS?</DialogTitle><DialogDescription>This permanently deletes the TDS entry for {deleting?.company_name}.</DialogDescription></DialogHeader><DialogFooter className="gap-2"><Button variant="outline" disabled={remove.isPending} onClick={() => setDeleting(null)}>Cancel</Button><Button variant="destructive" disabled={remove.isPending} onClick={() => { if (deleting) remove.mutate(deleting.id); }}>{remove.isPending ? "Deleting…" : "Delete TDS"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}