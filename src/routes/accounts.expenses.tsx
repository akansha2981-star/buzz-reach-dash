import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Receipt, Paperclip, FileText } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const BUCKET = "accounts-docs";
const GST_SCALE = 200000;

async function openBill(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600);
  if (error) return toast.error(error.message);
  window.open(data.signedUrl, "_blank");
}
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/accounts/expenses")({ component: ExpensesPage });

type Expense = {
  id: string; title: string; category: string | null; amount: number;
  currency: string; spent_on: string; vendor: string | null; payment_method: string | null; notes: string | null;
  gst_paid: number; attachment_url: string | null;
};

const CATEGORIES = ["Office", "Software", "Travel", "Marketing", "Salaries", "Utilities", "Meals", "Other"];

function ExpensesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["accounts_expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts_expenses").select("*").order("spent_on", { ascending: false });
      if (error) throw error;
      return data as Expense[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("accounts_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Expense deleted"); qc.invalidateQueries({ queryKey: ["accounts_expenses"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = filter === "all" ? expenses : expenses.filter(e => e.category === filter);
  const total = filtered.reduce((s, e) => s + Number(e.amount), 0);
  const thisMonth = expenses.filter(e => new Date(e.spent_on).getMonth() === new Date().getMonth() && new Date(e.spent_on).getFullYear() === new Date().getFullYear()).reduce((s, e) => s + Number(e.amount), 0);

  const gstTotal = expenses.reduce((s, e) => s + Number(e.gst_paid || 0), 0);
  const gstMonth = expenses.filter(e => new Date(e.spent_on).getMonth() === new Date().getMonth() && new Date(e.spent_on).getFullYear() === new Date().getFullYear()).reduce((s, e) => s + Number(e.gst_paid || 0), 0);
  const gstPct = Math.min(100, (gstTotal / GST_SCALE) * 100);
  const billCount = expenses.filter(e => e.attachment_url).length;

  return (
    <div className="space-y-4">
      <Card><CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="text-xs text-muted-foreground">GST paid till date</div>
            <div className="text-2xl font-semibold">₹{gstTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>This month: ₹{gstMonth.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</div>
            <div>{billCount} GST bill{billCount === 1 ? "" : "s"} uploaded</div>
          </div>
        </div>
        <Progress value={gstPct} className="h-3" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{gstPct.toFixed(1)}% of ₹{GST_SCALE.toLocaleString("en-IN")}</span>
          <span>₹{Math.max(0, GST_SCALE - gstTotal).toLocaleString("en-IN", { maximumFractionDigits: 2 })} left</span>
        </div>
      </CardContent></Card>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total expenses" value={`₹${total.toLocaleString()}`} />
        <StatCard label="This month" value={`₹${thisMonth.toLocaleString()}`} tone="amber" />
        <StatCard label="Entries" value={expenses.length.toString()} />
        <div className="flex items-center justify-end">
          <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-1 h-4 w-4" />Add expense</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>All</FilterChip>
        {CATEGORIES.map(c => (
          <FilterChip key={c} active={filter === c} onClick={() => setFilter(c)}>{c}</FilterChip>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
              <Receipt className="h-8 w-8" />
              <p className="text-sm">No expenses recorded.</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((exp) => (
                <div key={exp.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{exp.title}</span>
                      {exp.category && <Badge variant="secondary">{exp.category}</Badge>}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {format(new Date(exp.spent_on), "dd MMM yyyy")}
                      {exp.vendor && <> · {exp.vendor}</>}
                      {exp.payment_method && <> · {exp.payment_method}</>}
                      {Number(exp.gst_paid) > 0 && <> · GST ₹{Number(exp.gst_paid).toLocaleString("en-IN")}</>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {exp.attachment_url && <Button size="icon" variant="ghost" title="View GST bill" onClick={() => openBill(exp.attachment_url!)}><FileText className="h-4 w-4" /></Button>}
                    <div className="font-semibold">{exp.currency} {Number(exp.amount).toLocaleString()}</div>
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(exp); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete expense?")) del.mutate(exp.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ExpenseDialog open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-full border px-3 py-1 text-xs font-medium transition ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground hover:bg-muted"}`}>
      {children}
    </button>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const toneCls = tone === "amber" ? "text-amber-600" : "text-foreground";
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${toneCls}`}>{value}</div>
    </CardContent></Card>
  );
}

function ExpenseDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (o: boolean) => void; editing: Expense | null }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<Expense>>({});
  const [file, setFile] = useState<File | null>(null);
  const reset = () => setForm(editing ?? { currency: "INR", spent_on: new Date().toISOString().slice(0, 10), amount: 0 });
  useEffect(() => { if (open) { reset(); setFile(null); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open, editing]);

  const isEdit = !!editing;
  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form }; delete payload.id;
      payload.gst_paid = Number(payload.gst_paid || 0);
      if (file) {
        const path = `expenses/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined });
        if (upErr) throw upErr;
        payload.attachment_url = path;
      }
      if (isEdit) {
        const { error } = await supabase.from("accounts_expenses").update(payload).eq("id", editing!.id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from("accounts_expenses").insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Expense updated" : "Expense added");
      qc.invalidateQueries({ queryKey: ["accounts_expenses"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{isEdit ? "Edit expense" : "Add expense"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label>Title *</Label><Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Amount</Label><Input type="number" value={form.amount ?? 0} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div>
            <div><Label>Currency</Label><Input value={form.currency ?? "INR"} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Category</Label>
              <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">—</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><Label>Date</Label><Input type="date" value={form.spent_on ?? ""} onChange={(e) => setForm({ ...form, spent_on: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Vendor</Label><Input value={form.vendor ?? ""} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></div>
            <div><Label>Payment method</Label><Input value={form.payment_method ?? ""} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>GST paid (₹)</Label><Input type="number" min={0} value={form.gst_paid ?? 0} onChange={(e) => setForm({ ...form, gst_paid: Number(e.target.value) })} /></div>
            <div><Label>GST bill / invoice (optional)</Label>
              <label className="flex h-9 cursor-pointer items-center gap-2 truncate rounded-md border bg-background px-2 text-sm text-muted-foreground">
                <Paperclip className="h-4 w-4 shrink-0" />
                <span className="truncate">{file ? file.name : form.attachment_url ? "Replace bill" : "Upload file"}</span>
                <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
          </div>
          <div><Label>Notes</Label><Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!form.title || save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
