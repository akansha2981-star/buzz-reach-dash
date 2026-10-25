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

function computeStatus(total: number, paid: number, currentStatus: string): string {
  if (currentStatus === "cancelled") return "cancelled";
  if (paid <= 0) return currentStatus === "paid" || currentStatus === "partially_paid" ? "sent" : currentStatus;
  if (paid + 0.01 >= total) return "paid";
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

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const due = invoice ? Math.max(0, Number(invoice.total) - totalPaid) : 0;

  const syncInvoiceStatus = async (nextPaid: number) => {
    if (!invoice) return;
    const nextStatus = computeStatus(Number(invoice.total), nextPaid, invoice.status);
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
        <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3">
          <Stat label="Total" value={`${cur} ${Number(invoice.total).toLocaleString()}`} />
          <Stat label="Paid" value={`${cur} ${totalPaid.toLocaleString()}`} tone="emerald" />
          <Stat label="Due" value={`${cur} ${due.toLocaleString()}`} tone={due > 0 ? "amber" : "muted"} />
        </div>

        {due > 0 && (
          <Button variant="secondary" onClick={() => markFullyPaid.mutate()} disabled={markFullyPaid.isPending}>
            <CheckCircle2 className="h-4 w-4 mr-1" /> Mark as fully paid ({cur} {due.toLocaleString()})
          </Button>
        )}

        {/* Add new payment */}
        <section className="rounded-lg border p-3 space-y-3">
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
        </section>

        {/* History */}
        <section className="rounded-lg border">
          <div className="p-3 text-sm font-semibold border-b">Payment history</div>
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading…</div>
          ) : payments.length === 0 ? (
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
    : tone === "muted" ? "text-muted-foreground"
    : "text-foreground";
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${cls}`}>{value}</div>
    </div>
  );
}
