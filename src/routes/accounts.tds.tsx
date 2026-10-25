import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
  const filtered = rows.filter(row => row.company_name.toLowerCase().includes(search.trim().toLowerCase()));

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
    <div className="flex flex-col gap-4 border-y border-border py-4 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-xs font-medium text-muted-foreground">Total TDS</p><p className="mt-1 text-2xl font-semibold text-primary">{money(filtered.reduce((sum, r) => sum + Number(r.amount), 0))}</p><p className="text-xs text-muted-foreground">{filtered.length} entries</p></div>
      <div className="relative w-full sm:w-72"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search TDS companies" placeholder="Search company…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>
    </div>
    {records.isLoading ? <p className="py-8 text-center text-muted-foreground">Loading TDS…</p>
      : records.isError ? <div className="space-y-3 py-8 text-center"><p className="text-destructive">TDS entries could not be loaded.</p><Button variant="outline" onClick={() => records.refetch()}>Retry</Button></div>
      : filtered.length === 0 ? <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground"><Receipt className="h-8 w-8" /><p>{search ? "No matching TDS entries." : "No TDS entries yet."}</p></div>
      : <div className="divide-y divide-border">
        <div className="hidden grid-cols-[1fr_150px_160px_88px] gap-4 pb-3 text-xs font-medium text-muted-foreground sm:grid"><span>Company name</span><span>Date</span><span className="text-right">TDS amount</span><span className="text-right">Actions</span></div>
        {filtered.map(row => <div key={row.id} className="grid grid-cols-[1fr_auto] items-center gap-3 py-4 sm:grid-cols-[1fr_150px_160px_88px] sm:gap-4">
          <div className="min-w-0 break-words font-medium">{row.company_name}</div>
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