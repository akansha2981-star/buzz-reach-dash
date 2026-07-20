import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, FileText, Download, Eye, IndianRupee, Check, ChevronsUpDown, UserPlus, Save } from "lucide-react";
import { InvoicePaymentsDialog } from "@/components/accounts/InvoicePaymentsDialog";
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
import { downloadInvoicePDF, type InvoiceItem } from "@/lib/invoice-pdf";


export const Route = createFileRoute("/accounts/invoices")({ component: InvoicesPage });

type Invoice = {
  id: string; client: string; invoice_number: string | null;
  amount: number; tax: number; total: number; currency: string;
  issue_date: string; due_date: string | null; status: string; notes: string | null;
  client_location: string | null; client_email: string | null; client_phone: string | null;
  category: string | null; payment_mode: string | null;
  items: InvoiceItem[];
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

  const handleDownload = (inv: Invoice) => {
    downloadInvoicePDF({
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
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total invoices" value={invoices.length.toString()} />
        <StatCard label="Collected" value={`₹${totalCollected.toLocaleString()}`} tone="emerald" />
        <StatCard label="Outstanding" value={`₹${totalOutstanding.toLocaleString()}`} tone="amber" />
        <div className="flex items-center justify-end">
          <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-1 h-4 w-4" />New invoice</Button>
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

      <InvoiceDialog open={open} onOpenChange={setOpen} editing={editing} onDownload={handleDownload} existingInvoices={invoices} />
      <InvoicePaymentsDialog
        open={!!paymentsFor}
        onOpenChange={(o) => { if (!o) setPaymentsFor(null); }}
        invoice={paymentsFor}
      />
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
  items: InvoiceItem[];
};

const emptyForm = (existing: { invoice_number: string | null }[] = []): FormState => ({
  client: "", client_location: "", client_email: "", client_phone: "",
  invoice_number: nextInvoiceNumber(existing), currency: "INR",
  issue_date: new Date().toISOString().slice(0, 10), due_date: "",
  status: "draft", category: "", payment_mode: "Bank Transfer",
  notes: DEFAULT_NOTES,
  items: [{ name: "", description: "", amount: 0 }],
});

function InvoiceDialog({
  open, onOpenChange, editing, onDownload, existingInvoices,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; editing: Invoice | null;
  onDownload: (inv: Invoice) => void;
  existingInvoices: { invoice_number: string | null }[];
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
        items: editing.items.length ? editing.items : [{ name: "", description: "", amount: 0 }],
      });
    } else {
      setForm(emptyForm(existingInvoices));
    }
  }, [open, editing, existingInvoices]);

  const subtotal = form.items.reduce((s, it) => s + Number(it.amount || 0), 0);

  const updateItem = (idx: number, patch: Partial<InvoiceItem>) => {
    setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));
  };
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, { name: "", description: "", amount: 0 }] }));
  const removeItem = (idx: number) => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const save = useMutation({
    mutationFn: async () => {
      const cleanItems = form.items.filter((it) => it.name.trim() || Number(it.amount) > 0);
      const total = cleanItems.reduce((s, it) => s + Number(it.amount || 0), 0);
      const payload = {
        client: form.client, client_location: form.client_location || null,
        client_email: form.client_email || null, client_phone: form.client_phone || null,
        invoice_number: form.invoice_number || null, currency: form.currency,
        issue_date: form.issue_date, due_date: form.due_date || null,
        status: form.status, category: form.category || null,
        payment_mode: form.payment_mode || null, notes: form.notes || null,
        items: cleanItems, amount: total, tax: 0, total,
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
            <div className="flex justify-end pt-2 border-t">
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Total</div>
                <div className="text-xl font-bold">{form.currency} {subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
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
              id: "preview", status: form.status, amount: subtotal, tax: 0, total: subtotal,
              client: form.client || "Client", invoice_number: form.invoice_number,
              currency: form.currency, issue_date: form.issue_date,
              due_date: form.due_date || null, notes: form.notes,
              client_location: form.client_location || null, client_email: form.client_email || null,
              client_phone: form.client_phone || null, category: form.category || null,
              payment_mode: form.payment_mode || null, items: form.items,
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

