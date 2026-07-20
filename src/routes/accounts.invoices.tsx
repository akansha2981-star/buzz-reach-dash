import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/accounts/invoices")({ component: InvoicesPage });

type Invoice = {
  id: string; client: string; invoice_number: string | null;
  amount: number; tax: number; total: number; currency: string;
  issue_date: string; due_date: string | null; status: string; notes: string | null;
};

const STATUSES = ["draft", "sent", "paid", "overdue", "cancelled"];
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  paid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  overdue: "bg-red-500/10 text-red-700 dark:text-red-300",
  cancelled: "bg-zinc-500/10 text-zinc-600",
};

function InvoicesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["accounts_invoices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts_invoices").select("*").order("issue_date", { ascending: false });
      if (error) throw error;
      return data as Invoice[];
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

  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.total), 0);
  const totalOutstanding = invoices.filter(i => i.status !== "paid" && i.status !== "cancelled").reduce((s, i) => s + Number(i.total), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total invoices" value={invoices.length.toString()} />
        <StatCard label="Paid" value={`₹${totalPaid.toLocaleString()}`} tone="emerald" />
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
              {invoices.map((inv) => (
                <div key={inv.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{inv.client}</span>
                      {inv.invoice_number && <span className="text-xs text-muted-foreground">#{inv.invoice_number}</span>}
                      <Badge className={STATUS_COLORS[inv.status] || ""}>{inv.status}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {format(new Date(inv.issue_date), "dd MMM yyyy")}
                      {inv.due_date && <> · due {format(new Date(inv.due_date), "dd MMM")}</>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-semibold">{inv.currency} {Number(inv.total).toLocaleString()}</div>
                      <div className="text-[11px] text-muted-foreground">Tax {Number(inv.tax).toLocaleString()}</div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(inv); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete invoice?")) del.mutate(inv.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <InvoiceDialog open={open} onOpenChange={setOpen} editing={editing} />
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

function InvoiceDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (o: boolean) => void; editing: Invoice | null }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<Invoice>>({});
  const isEdit = !!editing;

  const reset = () => setForm(editing ?? { currency: "INR", status: "draft", issue_date: new Date().toISOString().slice(0, 10), amount: 0, tax: 0 });
  useEffect(() => { if (open) reset(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open, editing]);

  const save = useMutation({
    mutationFn: async () => {
      const total = Number(form.amount || 0) + Number(form.tax || 0);
      const payload: any = { ...form, total };
      delete payload.id;
      if (isEdit) {
        const { error } = await supabase.from("accounts_invoices").update(payload).eq("id", editing!.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from("accounts_invoices").insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Invoice updated" : "Invoice created");
      qc.invalidateQueries({ queryKey: ["accounts_invoices"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{isEdit ? "Edit invoice" : "New invoice"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Client *</Label><Input value={form.client ?? ""} onChange={(e) => setForm({ ...form, client: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Invoice #</Label><Input value={form.invoice_number ?? ""} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} /></div>
            <div><Label>Currency</Label><Input value={form.currency ?? "INR"} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Amount</Label><Input type="number" value={form.amount ?? 0} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div>
            <div><Label>Tax</Label><Input type="number" value={form.tax ?? 0} onChange={(e) => setForm({ ...form, tax: Number(e.target.value) })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Issue date</Label><Input type="date" value={form.issue_date ?? ""} onChange={(e) => setForm({ ...form, issue_date: e.target.value })} /></div>
            <div><Label>Due date</Label><Input type="date" value={form.due_date ?? ""} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status ?? "draft"} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Notes</Label><Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!form.client || save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
