import { invoiceGst, type GstMode } from "@/lib/gst";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, FileText, Download, Eye, IndianRupee, Check, ChevronsUpDown, UserPlus, Save, TrendingUp, Wallet, AlertCircle, CheckCircle2, Clock, Receipt, Sparkles } from "lucide-react";
import { InvoicePaymentsDialog } from "@/components/accounts/InvoicePaymentsDialog";
import { InvoicePreviewDialog } from "@/components/accounts/InvoicePreviewDialog";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { downloadInvoicePDF, type InvoiceItem, type InvoiceCompanyOverride } from "@/lib/invoice-pdf";
import { useCompanySettings, buildIdString } from "@/lib/company-settings";


export const Route = createFileRoute("/accounts/invoices")({ component: InvoicesPage });

type Invoice = {
  id: string; client: string; invoice_number: string | null;
  amount: number; tax: number; total: number; currency: string;
  issue_date: string; due_date: string | null; status: string; notes: string | null;
  client_location: string | null; client_email: string | null; client_phone: string | null;
  category: string | null; payment_mode: string | null;
  bank_account_id: string | null;
  gst_mode?: string | null;
  items: InvoiceItem[];
};

type BankAccountRow = {
  id: string; tag: string; account_holder: string; account_number: string;
  ifsc: string | null; bank_name: string | null; branch: string | null;
  branch_address: string | null; upi_id: string | null; is_default: boolean;
};

const STATUSES = ["draft", "sent", "partially_paid", "paid", "overdue", "cancelled"];
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  partially_paid: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  paid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  overdue: "bg-red-500/10 text-red-700 dark:text-red-300",
  cancelled: "bg-zinc-500/10 text-zinc-600",
};
const STATUS_LABELS: Record<string, string> = {
  partially_paid: "partially paid",
};

const DEFAULT_NOTES =
  "GST & BILLING DECLARATION: Please note that the GST registration for this engagement is currently under process. Until the completion of GST registration formalities, the invoice is being raised in the name of B-School Buzz, operated by Akaniya Ventures Pvt. Ltd., as per the bank details shared.";

function toItems(v: unknown): InvoiceItem[] {
  if (!Array.isArray(v)) return [];
  return v.map((it) => ({
    name: String((it as Record<string, unknown>)?.name ?? ""),
    description: String((it as Record<string, unknown>)?.description ?? ""),
    amount: Number((it as Record<string, unknown>)?.amount ?? 0),
  }));
}

function InvoicesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [paymentsFor, setPaymentsFor] = useState<Invoice | null>(null);
  const [previewFor, setPreviewFor] = useState<Invoice | null>(null);


  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["accounts_invoices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts_invoices").select("*").order("issue_date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((d) => ({ ...d, items: toItems((d as { items?: unknown }).items) })) as Invoice[];
    },
  });

  const { data: paidByInvoice = {} } = useQuery({
    queryKey: ["accounts_invoice_payments_sum"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts_invoice_payments").select("invoice_id, amount");
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const p of data ?? []) {
        const row = p as { invoice_id: string; amount: number };
        map[row.invoice_id] = (map[row.invoice_id] ?? 0) + Number(row.amount);
      }
      return map;
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("accounts_invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Invoice deleted"); qc.invalidateQueries({ queryKey: ["accounts_invoices"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalCollected = invoices.reduce((s, i) => s + (paidByInvoice[i.id] ?? (i.status === "paid" ? Number(i.total) : 0)), 0);
  const totalOutstanding = invoices
    .filter(i => i.status !== "cancelled")
    .reduce((s, i) => s + Math.max(0, Number(i.total) - (paidByInvoice[i.id] ?? 0)), 0);

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["accounts_bank_accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts_bank_accounts")
        .select("id,tag,account_holder,account_number,ifsc,bank_name,branch,branch_address,upi_id,is_default")
        .order("is_default", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BankAccountRow[];
    },
  });

  const bankById = useMemo(() => {
    const m: Record<string, BankAccountRow> = {};
    for (const b of bankAccounts) m[b.id] = b;
    return m;
  }, [bankAccounts]);

  const { data: company } = useCompanySettings();
  const companyOverride: InvoiceCompanyOverride | null = useMemo(() => {
    if (!company) return null;
    return {
      brand: company.brand,
      legal: company.legal_name,
      ids: buildIdString(company),
      address: company.address ?? undefined,
      email: company.email ?? undefined,
      phone: company.phone ?? undefined,
      signatory: company.signatory ?? undefined,
      terms: (company.terms ?? "").split("\n").map((s) => s.trim()).filter(Boolean),
    };
  }, [company]);

  const toPDFData = (inv: Invoice) => {
    const b = inv.bank_account_id ? bankById[inv.bank_account_id] : bankAccounts.find(x => x.is_default);
    return {
      invoice_number: inv.invoice_number || "DRAFT",
      issue_date: inv.issue_date,
      due_date: inv.due_date,
      payment_mode: inv.payment_mode,
      category: inv.category,
      client: inv.client,
      client_location: inv.client_location,
      client_email: inv.client_email,
      client_phone: inv.client_phone,
      items: inv.items.length ? inv.items : [{ name: "Service", description: "", amount: Number(inv.amount) }],
      currency: inv.currency,
      notes: inv.notes || DEFAULT_NOTES,
      company: companyOverride,
      bank: b ? {
        name: b.account_holder,
        number: b.account_number,
        ifsc: b.ifsc,
        branch: [b.bank_name, b.branch].filter(Boolean).join(" — ") || b.branch,
        branchAddress: b.branch_address,
        upi: b.upi_id,
        tag: b.tag,
      } : null,
    };
  };


  const handleDownload = (inv: Invoice) => {
    downloadInvoicePDF(toPDFData(inv));
  };



  // ==== Analytics ====
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const grandTotal = invoices.reduce((s, i) => s + Number(i.total), 0);
  const collectionRate = grandTotal > 0 ? Math.round((totalCollected / grandTotal) * 100) : 0;
  const overdueList = invoices.filter(i => i.due_date && new Date(i.due_date) < now && (paidByInvoice[i.id] ?? 0) < Number(i.total) && i.status !== "cancelled" && i.status !== "paid");
  const overdueAmt = overdueList.reduce((s, i) => s + Math.max(0, Number(i.total) - (paidByInvoice[i.id] ?? 0)), 0);
  const monthInvoices = invoices.filter(i => new Date(i.issue_date) >= monthStart);
  const monthBilled = monthInvoices.reduce((s, i) => s + Number(i.total), 0);
  const statusCounts = invoices.reduce<Record<string, number>>((m, i) => { m[i.status] = (m[i.status] ?? 0) + 1; return m; }, {});

  return (
    <div className="space-y-6">
      {/* ============== HERO SUMMARY ============== */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white shadow-xl">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,white_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-amber-400/20 blur-3xl" />
        <div className="absolute -left-24 bottom-0 h-64 w-64 rounded-full bg-indigo-500/30 blur-3xl" />

        <div className="relative p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-amber-300/90">
                <Sparkles className="h-3.5 w-3.5" /> Invoice Command Center
              </div>
              <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Invoice Management</h1>
              <p className="mt-1 text-sm text-slate-300">Track billings, payments and outstanding dues in real-time.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary" size="sm" className="bg-white/10 text-white hover:bg-white/20 border-white/20">
                <Link to="/accounts/clients"><UserPlus className="mr-1 h-4 w-4" />Clients</Link>
              </Button>
              <Button onClick={() => { setEditing(null); setOpen(true); }} className="bg-amber-400 text-slate-900 hover:bg-amber-300 font-semibold shadow-lg">
                <Plus className="mr-1 h-4 w-4" />New invoice
              </Button>
            </div>
          </div>

          {/* KPI row */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <HeroStat icon={<Receipt className="h-4 w-4" />} label="Total billed" value={`₹${grandTotal.toLocaleString("en-IN")}`} sub={`${invoices.length} invoice${invoices.length===1?"":"s"}`} />
            <HeroStat icon={<CheckCircle2 className="h-4 w-4" />} label="Collected" value={`₹${totalCollected.toLocaleString("en-IN")}`} sub={`${collectionRate}% collection rate`} accent="emerald" />
            <HeroStat icon={<Clock className="h-4 w-4" />} label="Outstanding" value={`₹${totalOutstanding.toLocaleString("en-IN")}`} sub={overdueAmt>0?`₹${overdueAmt.toLocaleString("en-IN")} overdue`:"On track"} accent="amber" />
            <HeroStat icon={<TrendingUp className="h-4 w-4" />} label="This month" value={`₹${monthBilled.toLocaleString("en-IN")}`} sub={`${monthInvoices.length} new invoice${monthInvoices.length===1?"":"s"}`} accent="sky" />
          </div>

          {/* Collection progress */}
          <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5 text-amber-300" /> Collection progress</span>
              <span className="font-semibold text-white">{collectionRate}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-gradient-to-r from-emerald-400 via-amber-300 to-amber-400 transition-all" style={{ width: `${collectionRate}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
              <span>Paid <span className="text-emerald-300 font-medium">₹{totalCollected.toLocaleString("en-IN")}</span></span>
              <span>Pending <span className="text-amber-300 font-medium">₹{totalOutstanding.toLocaleString("en-IN")}</span></span>
              {overdueList.length > 0 && (
                <span className="flex items-center gap-1 text-rose-300"><AlertCircle className="h-3 w-3" />{overdueList.length} overdue</span>
              )}
            </div>
          </div>

          {/* Status pills */}
          {invoices.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {STATUSES.map((s) => statusCounts[s] ? (
                <span key={s} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-200">
                  <span className={cn("h-1.5 w-1.5 rounded-full",
                    s==="paid" && "bg-emerald-400",
                    s==="partially_paid" && "bg-amber-400",
                    s==="sent" && "bg-sky-400",
                    s==="draft" && "bg-slate-400",
                    s==="overdue" && "bg-rose-400",
                    s==="cancelled" && "bg-zinc-500",
                  )} />
                  <span className="capitalize">{(STATUS_LABELS[s] ?? s).replace("_"," ")}</span>
                  <span className="font-semibold text-white">{statusCounts[s]}</span>
                </span>
              ) : null)}
            </div>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
              <FileText className="h-8 w-8" />
              <p className="text-sm">No invoices yet. Create your first one.</p>
            </div>
          ) : (
            <div className="divide-y">
              {invoices.map((inv) => {
                const paid = paidByInvoice[inv.id] ?? 0;
                const due = Math.max(0, Number(inv.total) - paid);
                return (
                  <div key={inv.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium truncate">{inv.client}</span>
                        {inv.invoice_number && <span className="text-xs text-muted-foreground">#{inv.invoice_number}</span>}
                        <Badge className={STATUS_COLORS[inv.status] || ""}>{STATUS_LABELS[inv.status] ?? inv.status}</Badge>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {format(new Date(inv.issue_date), "dd MMM yyyy")}
                        {inv.due_date && <> · due {format(new Date(inv.due_date), "dd MMM")}</>}
                        {inv.items.length > 0 && <> · {inv.items.length} item{inv.items.length > 1 ? "s" : ""}</>}
                      </div>
                      {paid > 0 && (
                        <div className="mt-1 text-xs">
                          <span className="text-emerald-600 font-medium">Paid {inv.currency} {paid.toLocaleString()}</span>
                          {due > 0 && <span className="text-amber-600"> · Due {inv.currency} {due.toLocaleString()}</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2">
                      <div className="text-right mr-2">
                        <div className="font-semibold">{inv.currency} {Number(inv.total).toLocaleString()}</div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setPaymentsFor(inv)} title="Payments">
                        <IndianRupee className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Payments</span>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setPreviewFor(inv)} title="View PDF">
                        <Eye className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">View</span>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDownload(inv)}>
                        <Download className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">PDF</span>
                      </Button>

                      <Button size="icon" variant="ghost" onClick={() => { setEditing(inv); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete invoice?")) del.mutate(inv.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <InvoiceDialog open={open} onOpenChange={setOpen} editing={editing} onDownload={handleDownload} existingInvoices={invoices} bankAccounts={bankAccounts} />
      <InvoicePaymentsDialog
        open={!!paymentsFor}
        onOpenChange={(o) => { if (!o) setPaymentsFor(null); }}
        invoice={paymentsFor}
      />
      <InvoicePreviewDialog
        open={!!previewFor}
        onOpenChange={(o) => { if (!o) setPreviewFor(null); }}
        invoice={previewFor ? toPDFData(previewFor) : null}
      />
    </div>
  );

}


function HeroStat({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub?: string; accent?: "emerald"|"amber"|"sky" }) {
  const dot = accent === "emerald" ? "text-emerald-300 bg-emerald-400/10 ring-emerald-400/30"
    : accent === "amber" ? "text-amber-300 bg-amber-400/10 ring-amber-400/30"
    : accent === "sky" ? "text-sky-300 bg-sky-400/10 ring-sky-400/30"
    : "text-slate-200 bg-white/10 ring-white/20";
  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-3.5 backdrop-blur transition hover:bg-white/10">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-300">{label}</span>
        <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-md ring-1", dot)}>{icon}</span>
      </div>
      <div className="mt-1.5 text-lg font-bold tracking-tight text-white sm:text-xl">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const toneCls = tone === "emerald" ? "text-emerald-600" : tone === "amber" ? "text-amber-600" : "text-foreground";
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${toneCls}`}>{value}</div>
    </CardContent></Card>
  );
}

const INVOICE_START_SEQ = 400;
function nextInvoiceNumber(existing: { invoice_number: string | null }[] = []): string {
  const year = new Date().getFullYear();
  const prefix = `BSB-${year}-`;
  let max = INVOICE_START_SEQ - 1;
  for (const inv of existing) {
    const n = inv.invoice_number;
    if (!n || !n.startsWith(prefix)) continue;
    const num = parseInt(n.slice(prefix.length), 10);
    if (!isNaN(num) && num > max) max = num;
  }
  return `${prefix}${max + 1}`;
}

type FormState = {
  client: string;
  client_location: string;
  client_email: string;
  client_phone: string;
  invoice_number: string;
  currency: string;
  issue_date: string;
  due_date: string;
  status: string;
  category: string;
  payment_mode: string;
  notes: string;
  bank_account_id: string | null;
  gst_mode: GstMode;
  items: InvoiceItem[];
};

const emptyForm = (existing: { invoice_number: string | null }[] = []): FormState => ({
  client: "", client_location: "", client_email: "", client_phone: "",
  invoice_number: nextInvoiceNumber(existing), currency: "INR",
  issue_date: new Date().toISOString().slice(0, 10), due_date: "",
  status: "draft", category: "", payment_mode: "Bank Transfer",
  notes: DEFAULT_NOTES,
  bank_account_id: null,
  gst_mode: "none",
  items: [{ name: "", description: "", amount: 0 }],
});

function InvoiceDialog({
  open, onOpenChange, editing, onDownload, existingInvoices, bankAccounts,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; editing: Invoice | null;
  onDownload: (inv: Invoice) => void;
  existingInvoices: { invoice_number: string | null }[];
  bankAccounts: BankAccountRow[];
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm(existingInvoices));
  const isEdit = !!editing;

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        client: editing.client, client_location: editing.client_location || "",
        client_email: editing.client_email || "", client_phone: editing.client_phone || "",
        invoice_number: editing.invoice_number || nextInvoiceNumber(existingInvoices),
        currency: editing.currency, issue_date: editing.issue_date,
        due_date: editing.due_date || "", status: editing.status,
        category: editing.category || "", payment_mode: editing.payment_mode || "Bank Transfer",
        notes: editing.notes || DEFAULT_NOTES,
        bank_account_id: editing.bank_account_id ?? null,
        gst_mode: (editing.gst_mode as GstMode) || "none",
        items: editing.items.length ? editing.items : [{ name: "", description: "", amount: 0 }],
      });
    } else {
      const def = bankAccounts.find((b) => b.is_default) ?? bankAccounts[0];
      setForm({ ...emptyForm(existingInvoices), bank_account_id: def?.id ?? null });
    }
  }, [open, editing, existingInvoices, bankAccounts]);

  const subtotal = form.items.reduce((s, it) => s + Number(it.amount || 0), 0);
  const calc = invoiceGst(subtotal, form.gst_mode);

  const updateItem = (idx: number, patch: Partial<InvoiceItem>) => {
    setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));
  };
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, { name: "", description: "", amount: 0 }] }));
  const removeItem = (idx: number) => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const save = useMutation({
    mutationFn: async () => {
      const cleanItems = form.items.filter((it) => it.name.trim() || Number(it.amount) > 0);
      const g = invoiceGst(cleanItems.reduce((s, it) => s + Number(it.amount || 0), 0), form.gst_mode);
      const payload = {
        client: form.client, client_location: form.client_location || null,
        client_email: form.client_email || null, client_phone: form.client_phone || null,
        invoice_number: form.invoice_number || null, currency: form.currency,
        issue_date: form.issue_date, due_date: form.due_date || null,
        status: form.status, category: form.category || null,
        payment_mode: form.payment_mode || null, notes: form.notes || null,
        bank_account_id: form.bank_account_id,
        items: cleanItems, amount: g.base, tax: g.gst, total: g.total, gst_mode: form.gst_mode,
      };
      if (isEdit) {
        const { data, error } = await supabase.from("accounts_invoices").update(payload).eq("id", editing!.id).select("*").single();
        if (error) throw error;
        return data;
      } else {
        const { data: userRes } = await supabase.auth.getUser();
        const { data, error } = await supabase.from("accounts_invoices")
          .insert({ ...payload, created_by: userRes.user?.id }).select("*").single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (data, _vars, _ctx) => {
      toast.success(isEdit ? "Invoice updated" : "Invoice created");
      qc.invalidateQueries({ queryKey: ["accounts_invoices"] });
      onOpenChange(false);
      // Auto-download PDF right after save
      if (data) {
        const inv = { ...data, items: toItems((data as { items?: unknown }).items) } as Invoice;
        onDownload(inv);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit invoice" : "New invoice"}</DialogTitle>
          <p className="text-xs text-muted-foreground">Company details are auto-included. Just enter client & items — PDF will download on save.</p>
        </DialogHeader>

        <div className="grid gap-4">
          {/* Client */}
          <ClientPickerSection form={form} setForm={setForm} />

          {/* Invoice meta */}
          <section className="rounded-lg border p-3 space-y-3">

            <h3 className="text-sm font-semibold">Invoice details</h3>
            <div className="grid gap-2 sm:grid-cols-3">
              <div><Label>Invoice #</Label><Input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} /></div>
              <div><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
              <div>
                <Label>Payment mode</Label>
                <Select value={form.payment_mode} onValueChange={(v) => setForm({ ...form, payment_mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Bank Transfer", "UPI", "Cash", "Cheque", "Card"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Issue date</Label><Input type="date" value={form.issue_date} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} /></div>
              <div><Label>Due date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Receive payment into */}
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label>Receive payment into</Label>
                <Link to="/accounts/bank-accounts" className="text-xs text-primary hover:underline">Manage accounts →</Link>
              </div>
              {bankAccounts.length === 0 ? (
                <div className="mt-1 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  No payment accounts yet. <Link to="/accounts/bank-accounts" className="text-primary hover:underline">Add one</Link> so it appears on the invoice PDF.
                </div>
              ) : (
                <>
                  <Select
                    value={form.bank_account_id ?? "none"}
                    onValueChange={(v) => setForm({ ...form, bank_account_id: v === "none" ? null : v })}
                  >
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select account" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— No account on PDF —</SelectItem>
                      {bankAccounts.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          [{b.tag}] {b.account_holder} · {b.account_number}
                          {b.is_default ? " ★" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {bankAccounts.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setForm({ ...form, bank_account_id: b.id })}
                        className={cn(
                          "text-[10px] px-2 py-0.5 rounded border transition",
                          form.bank_account_id === b.id
                            ? "bg-primary text-primary-foreground border-primary"
                            : "hover:bg-muted",
                        )}
                      >
                        {b.tag}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Items */}
          <section className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Products / Services</h3>
              <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Add item</Button>
            </div>
            <div className="space-y-2">
              {form.items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-start rounded-md border p-2">
                  <div className="col-span-12 sm:col-span-4">
                    <Label className="text-xs">Name</Label>
                    <Input value={it.name} onChange={(e) => updateItem(idx, { name: e.target.value })} placeholder="Website Development" />
                  </div>
                  <div className="col-span-12 sm:col-span-5">
                    <Label className="text-xs">Description</Label>
                    <Input value={it.description || ""} onChange={(e) => updateItem(idx, { description: e.target.value })} placeholder="Advance 50% Payment" />
                  </div>
                  <div className="col-span-9 sm:col-span-2">
                    <Label className="text-xs">Amount</Label>
                    <Input type="number" value={it.amount} onChange={(e) => updateItem(idx, { amount: Number(e.target.value) })} />
                  </div>
                  <div className="col-span-3 sm:col-span-1 flex items-end justify-end h-full">
                    <Button size="icon" variant="ghost" onClick={() => removeItem(idx)} disabled={form.items.length === 1}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs">GST</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {([["inclusive","Includes GST","Amount already has 18% GST"],["none","No GST","Final amount only"],["additional","Additional GST","Add 18% on top"]] as const).map(([v,l,d]) => (
                  <button type="button" key={v} onClick={() => setForm({ ...form, gst_mode: v })}
                    className={cn("rounded-md border p-2 text-left text-sm transition-colors", form.gst_mode === v ? "border-primary bg-primary/10" : "hover:bg-muted")}>
                    <div className="font-medium">{l}</div><div className="text-xs text-muted-foreground">{d}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end">
              <div className="text-right space-y-0.5 text-sm">
                <div className="text-muted-foreground">Service amount: <span className="font-medium text-foreground">{form.currency} {calc.base.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div>
                <div className="text-muted-foreground">GST (18%): <span className="font-medium text-foreground">{form.currency} {calc.gst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div>
                <div className="text-xs text-muted-foreground pt-1">Total</div>
                <div className="text-xl font-bold">{form.currency} {calc.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border p-3 space-y-2">
            <Label>Notes / Declaration</Label>
            <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </section>
        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="secondary"
            onClick={() => onDownload({
              id: "preview", status: form.status, amount: calc.base, tax: calc.gst, total: calc.total, gst_mode: form.gst_mode,
              client: form.client || "Client", invoice_number: form.invoice_number,
              currency: form.currency, issue_date: form.issue_date,
              due_date: form.due_date || null, notes: form.notes,
              client_location: form.client_location || null, client_email: form.client_email || null,
              client_phone: form.client_phone || null, category: form.category || null,
              payment_mode: form.payment_mode || null, items: form.items,
              bank_account_id: form.bank_account_id,
            })}
            disabled={!form.client}
          >
            <Eye className="h-4 w-4 mr-1" />Preview PDF
          </Button>
          <Button onClick={() => save.mutate()} disabled={!form.client || save.isPending}>
            <Download className="h-4 w-4 mr-1" />{save.isPending ? "Saving…" : "Save & Download PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type SavedClient = {
  id: string; name: string;
  location: string | null; email: string | null; phone: string | null;
  category: string | null; gstin: string | null;
};

function ClientPickerSection({
  form, setForm,
}: {
  form: FormState;
  setForm: (updater: FormState | ((prev: FormState) => FormState)) => void;
}) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"saved" | "new">("saved");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["accounts_clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts_clients")
        .select("id,name,location,email,phone,category,gstin")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SavedClient[];
    },
  });

  // If there are no saved clients, default to manual entry.
  useEffect(() => {
    if (!isLoading && clients.length === 0) setMode("new");
  }, [isLoading, clients.length]);

  const selected = useMemo(
    () => clients.find((c) => c.id === selectedId) ?? null,
    [clients, selectedId],
  );

  const applyClient = (c: SavedClient) => {
    setSelectedId(c.id);
    setForm((f) => ({
      ...f,
      client: c.name,
      client_location: c.location ?? "",
      client_email: c.email ?? "",
      client_phone: c.phone ?? "",
      category: c.category ?? f.category,
    }));
    setPickerOpen(false);
  };

  const saveToDirectory = useMutation({
    mutationFn: async () => {
      if (!form.client.trim()) throw new Error("Enter a client name first");
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("accounts_clients").insert({
        name: form.client.trim(),
        location: form.client_location || null,
        email: form.client_email || null,
        phone: form.client_phone || null,
        category: form.category || null,
        created_by: userRes.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Client saved to directory");
      qc.invalidateQueries({ queryKey: ["accounts_clients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-lg border p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Client details</h3>
        <div className="inline-flex rounded-md border p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMode("saved")}
            className={cn("px-2 py-1 rounded", mode === "saved" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
          >
            Saved client
          </button>
          <button
            type="button"
            onClick={() => { setMode("new"); setSelectedId(null); }}
            className={cn("px-2 py-1 rounded", mode === "new" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
          >
            <UserPlus className="inline h-3 w-3 mr-1" />New client
          </button>
        </div>
      </div>

      {mode === "saved" ? (
        <div className="space-y-2">
          <Label>Select client</Label>
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                {selected ? selected.name : (form.client || "Search saved clients…")}
                <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search by name, email, phone…" />
                <CommandList>
                  <CommandEmpty>
                    {isLoading ? "Loading…" : "No clients found. Switch to New client to add one."}
                  </CommandEmpty>
                  <CommandGroup>
                    {clients.map((c) => (
                      <CommandItem
                        key={c.id}
                        value={`${c.name} ${c.email ?? ""} ${c.phone ?? ""} ${c.location ?? ""}`}
                        onSelect={() => applyClient(c)}
                      >
                        <Check className={cn("mr-2 h-4 w-4", selectedId === c.id ? "opacity-100" : "opacity-0")} />
                        <div className="min-w-0">
                          <div className="truncate font-medium">{c.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {[c.location, c.email, c.phone].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {selected && (
            <div className="rounded-md border bg-muted/40 p-2 text-xs space-y-0.5">
              <div><span className="text-muted-foreground">Location: </span>{selected.location || "—"}</div>
              <div><span className="text-muted-foreground">Email: </span>{selected.email || "—"}</div>
              <div><span className="text-muted-foreground">Phone: </span>{selected.phone || "—"}</div>
              {selected.gstin && <div><span className="text-muted-foreground">GSTIN: </span>{selected.gstin}</div>}
            </div>
          )}
        </div>
      ) : (
        <>
          <div><Label>Client name *</Label><Input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} placeholder="Ishita Knitfab Pvt Ltd" /></div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div><Label>Location</Label><Input value={form.client_location} onChange={(e) => setForm({ ...form, client_location: e.target.value })} placeholder="Ludhiana, Punjab" /></div>
            <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Textile" /></div>
            <div><Label>Client email</Label><Input value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} /></div>
            <div><Label>Client phone</Label><Input value={form.client_phone} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} /></div>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => saveToDirectory.mutate()}
              disabled={!form.client.trim() || saveToDirectory.isPending}
            >
              <Save className="h-3.5 w-3.5 mr-1" />
              {saveToDirectory.isPending ? "Saving…" : "Save to client directory"}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

