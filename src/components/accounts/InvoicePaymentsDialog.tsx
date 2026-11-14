import { useState } from "react";
import { GstBox } from "@/components/accounts/GstBox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, IndianRupee, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { splitTdsSettlement, bankFromTds } from "@/lib/tds";

export type PaymentRow = {
  id: string;
  invoice_id: string;
  amount: number;
  paid_on: string;
  method: string | null;
  reference: string | null;
  note: string | null;
  created_at: string;
};

type InvoiceLite = {
  id: string;
  client: string;
  invoice_number: string | null;
  total: number;
  currency: string;
  status: string;
};

const METHODS = ["Bank Transfer", "UPI", "Cash", "Cheque", "Card", "Other"];

function computeStatus(total: number, paid: number, currentStatus: string, tds = 0): string {
  if (currentStatus === "cancelled") return "cancelled";
  if (paid <= 0) return ["paid", "partially_paid", "paid_with_tds"].includes(currentStatus) ? "sent" : currentStatus;
  if (paid + 0.01 >= total) return tds > 0 ? "paid_with_tds" : "paid";
  return "partially_paid";
}

export function InvoicePaymentsDialog({
  open, onOpenChange, invoice,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  invoice: InvoiceLite | null;
}) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState<string>("");
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("Bank Transfer");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [gst, setGst] = useState(false);
  const [mode, setMode] = useState<"payment" | "tds">("payment");
  const [tdsAmt, setTdsAmt] = useState("");
  const [bankAmt, setBankAmt] = useState("");

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["invoice_payments", invoice?.id],
    enabled: !!invoice?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts_invoice_payments")
        .select("*")
        .eq("invoice_id", invoice!.id)
        .order("paid_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PaymentRow[];
    },
  });

  const { data: tdsRows = [] } = useQuery({
    queryKey: ["invoice_tds", invoice?.id],
    enabled: !!invoice?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts_tds").select("*").eq("invoice_id", invoice!.id).order("tds_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const bankPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const tdsPaid = tdsRows.reduce((s, t) => s + Number(t.amount), 0);
  const totalPaid = bankPaid + tdsPaid;
  const due = invoice ? Math.max(0, Number(invoice.total) - totalPaid) : 0;

  const syncInvoiceStatus = async (nextPaid: number, nextTds = tdsPaid) => {
    if (!invoice) return;
    const nextStatus = computeStatus(Number(invoice.total), nextPaid, invoice.status, nextTds);
    if (nextStatus !== invoice.status) {
      await supabase.from("accounts_invoices").update({ status: nextStatus }).eq("id", invoice.id);
    }
  };

  const addPayment = useMutation({
    mutationFn: async () => {
      if (!invoice) return;
      const amt = Number(amount);
      if (!amt || amt <= 0) throw new Error("Enter a valid amount");
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("accounts_invoice_payments").insert({
        invoice_id: invoice.id,
        amount: amt,
        paid_on: paidOn,
        method: method || null,
        reference: reference || null,
        note: note || null,
        gst_applicable: gst,
        created_by: userRes.user?.id ?? null,
      });
      if (error) throw error;
      await syncInvoiceStatus(totalPaid + amt);
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      setAmount(""); setReference(""); setNote("");
      qc.invalidateQueries({ queryKey: ["invoice_payments", invoice?.id] });
      qc.invalidateQueries({ queryKey: ["accounts_invoices"] }); qc.invalidateQueries({ queryKey: ["accounts_invoice_payments_sum"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["invoice_payments", invoice?.id] });
    qc.invalidateQueries({ queryKey: ["invoice_tds", invoice?.id] });
    qc.invalidateQueries({ queryKey: ["accounts_tds"] });
    qc.invalidateQueries({ queryKey: ["accounts_invoices"] }); qc.invalidateQueries({ queryKey: ["accounts_invoice_payments_sum"] });
  };
  const split = splitTdsSettlement(due, Number(bankAmt), Number(tdsAmt));
  const payWithTds = useMutation({
    mutationFn: async () => {
      if (!invoice) return;
      if (split.tds <= 0) throw new Error("Enter the TDS amount deducted by the client");
      if (split.overpaid) throw new Error("Bank + TDS is more than the amount due");
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id ?? null;
      if (split.bank > 0) {
        const { error } = await supabase.from("accounts_invoice_payments").insert({
          invoice_id: invoice.id, amount: split.bank, paid_on: paidOn, method: method || null,
          reference: reference || null, note: note || `Received after TDS of ₹${split.tds.toLocaleString("en-IN")}`,
          gst_applicable: gst, created_by: uid,
        });
        if (error) throw error;
      }
      const { error: tErr } = await supabase.from("accounts_tds").insert({
        tds_date: paidOn, amount: split.tds, company_name: invoice.client, invoice_id: invoice.id,
        invoice_number: invoice.invoice_number, invoice_total: Number(invoice.total), bank_amount: split.bank, created_by: uid,
      });
      if (tErr) throw tErr;
      await syncInvoiceStatus(totalPaid + split.settled, tdsPaid + split.tds);
    },
    onSuccess: () => {
      toast.success(`Recorded: ₹${split.bank.toLocaleString("en-IN")} to bank, ₹${split.tds.toLocaleString("en-IN")} to TDS`);
      setTdsAmt(""); setBankAmt(""); setReference(""); setNote(""); setMode("payment");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delTds = useMutation({
    mutationFn: async (id: string, ) => {
      const row = tdsRows.find((t) => t.id === id);
      const { error } = await supabase.from("accounts_tds").delete().eq("id", id);
      if (error) throw error;
      const amt = Number(row?.amount ?? 0);
      await syncInvoiceStatus(totalPaid - amt, tdsPaid - amt);
    },
    onSuccess: () => { toast.success("TDS removed"); invalidateAll(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delPayment = useMutation({
    mutationFn: async (p: PaymentRow) => {
      const { error } = await supabase.from("accounts_invoice_payments").delete().eq("id", p.id);
      if (error) throw error;
      await syncInvoiceStatus(totalPaid - Number(p.amount));
    },
    onSuccess: () => {
      toast.success("Payment removed");
      qc.invalidateQueries({ queryKey: ["invoice_payments", invoice?.id] });
      qc.invalidateQueries({ queryKey: ["accounts_invoices"] }); qc.invalidateQueries({ queryKey: ["accounts_invoice_payments_sum"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markFullyPaid = useMutation({
    mutationFn: async () => {
      if (!invoice || due <= 0) return;
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("accounts_invoice_payments").insert({
        invoice_id: invoice.id,
        amount: due,
        paid_on: new Date().toISOString().slice(0, 10),
        method: "Bank Transfer",
        note: "Marked as paid",
        created_by: userRes.user?.id ?? null,
      });
      if (error) throw error;
      await syncInvoiceStatus(Number(invoice.total));
    },
    onSuccess: () => {
      toast.success("Invoice marked paid");
      qc.invalidateQueries({ queryKey: ["invoice_payments", invoice?.id] });
      qc.invalidateQueries({ queryKey: ["accounts_invoices"] }); qc.invalidateQueries({ queryKey: ["accounts_invoice_payments_sum"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!invoice) return null;
  const cur = invoice.currency || "INR";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IndianRupee className="h-5 w-5" /> Payments · {invoice.client}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {invoice.invoice_number ? `#${invoice.invoice_number} · ` : ""}Track partial and full payments for this invoice.
          </p>
        </DialogHeader>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-4">
          <Stat label="Total" value={`${cur} ${Number(invoice.total).toLocaleString()}`} />
          <Stat label="In bank" value={`${cur} ${bankPaid.toLocaleString()}`} tone="emerald" />
          <Stat label="TDS" value={`${cur} ${tdsPaid.toLocaleString()}`} tone="sky" />
          <Stat label="Due" value={`${cur} ${due.toLocaleString()}`} tone={due > 0 ? "amber" : "muted"} />
        </div>

        {due > 0 && (
          <Button variant="secondary" onClick={() => markFullyPaid.mutate()} disabled={markFullyPaid.isPending}>
            <CheckCircle2 className="h-4 w-4 mr-1" /> Mark as fully paid ({cur} {due.toLocaleString()})
          </Button>
        )}

        {due > 0 && (
          <div className="grid grid-cols-2 gap-1 rounded-lg border bg-muted/40 p-1" role="tablist">
            <Button type="button" size="sm" variant={mode === "payment" ? "default" : "ghost"} onClick={() => setMode("payment")}>Payment / Partial</Button>
            <Button type="button" size="sm" variant={mode === "tds" ? "default" : "ghost"} onClick={() => { setMode("tds"); if (!bankAmt && !tdsAmt) setBankAmt(String(due)); }}>Paid with TDS</Button>
          </div>
        )}

        {mode === "tds" && due > 0 && (
          <section className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Paid with TDS</h3>
              <p className="text-xs text-muted-foreground">Enter TDS deducted — the bank amount fills automatically. Bank goes to your balance, TDS goes to the TDS section.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div><Label>TDS deducted (₹) *</Label><Input type="number" inputMode="decimal" value={tdsAmt} onChange={(e) => { setTdsAmt(e.target.value); setBankAmt(String(bankFromTds(due, Number(e.target.value)))); }} placeholder="e.g. 1000" /></div>
              <div><Label>Received in bank (₹)</Label><Input type="number" inputMode="decimal" value={bankAmt} onChange={(e) => setBankAmt(e.target.value)} /></div>
              <div><Label>Date</Label><Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} /></div>
              <div><Label>Reference (Txn / UTR)</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / cheque #" /></div>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-md border bg-background p-2 text-center text-xs">
              <div><div className="text-muted-foreground">Bank</div><div className="font-semibold text-emerald-600">₹{split.bank.toLocaleString("en-IN")}</div></div>
              <div><div className="text-muted-foreground">TDS</div><div className="font-semibold text-sky-600">₹{split.tds.toLocaleString("en-IN")}</div></div>
              <div><div className="text-muted-foreground">{split.overpaid ? "Over by" : "Still due"}</div><div className={`font-semibold ${split.overpaid ? "text-destructive" : split.remaining > 0 ? "text-amber-600" : "text-emerald-600"}`}>₹{(split.overpaid ? split.settled - due : split.remaining).toLocaleString("en-IN")}</div></div>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => payWithTds.mutate()} disabled={payWithTds.isPending || split.tds <= 0 || split.overpaid}>
                <CheckCircle2 className="h-4 w-4 mr-1" />{split.fullyPaid ? "Mark paid with TDS" : "Record with TDS"}
              </Button>
            </div>
          </section>
        )}

        {/* Add new payment */}
        {mode === "payment" && <section className="rounded-lg border p-3 space-y-3">
          <h3 className="text-sm font-semibold">Record payment</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label>Amount *</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={due > 0 ? String(due) : "0"} />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
            </div>
            <div>
              <Label>Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reference (Txn / UTR)</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / cheque #" />
            </div>
            <div className="sm:col-span-2">
              <Label>Note</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
            </div>
            <div className="sm:col-span-2">
              <GstBox applicable={gst} amount={Number(amount || 0)} onChange={setGst} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => addPayment.mutate()} disabled={addPayment.isPending || !amount}>
              <Plus className="h-4 w-4 mr-1" />Add payment
            </Button>
          </div>
        </section>}

        {/* History */}
        <section className="rounded-lg border">
          <div className="p-3 text-sm font-semibold border-b">Payment history</div>
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading…</div>
          ) : payments.length === 0 && tdsRows.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No payments recorded yet.</div>
          ) : (
            <div className="divide-y">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{cur} {Number(p.amount).toLocaleString()}</span>
                      {p.method && <Badge variant="outline" className="text-xs">{p.method}</Badge>}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground truncate">
                      {format(new Date(p.paid_on), "dd MMM yyyy")}
                      {p.reference && <> · {p.reference}</>}
                      {p.note && <> · {p.note}</>}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remove payment?")) delPayment.mutate(p); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {tdsRows.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{cur} {Number(t.amount).toLocaleString()}</span>
                      <Badge variant="outline" className="text-xs border-sky-300 text-sky-700">TDS</Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{format(new Date(t.tds_date), "dd MMM yyyy")} · deducted by client</div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remove TDS entry?")) delTds.mutate(t.id); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const cls =
    tone === "emerald" ? "text-emerald-600"
    : tone === "amber" ? "text-amber-600"
    : tone === "sky" ? "text-sky-600"
    : tone === "muted" ? "text-muted-foreground"
    : "text-foreground";
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${cls}`}>{value}</div>
    </div>
  );
}
