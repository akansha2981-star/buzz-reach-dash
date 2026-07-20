import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Receipt } from "lucide-react";
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

  return (
    <div className="space-y-4">
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
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
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
  const reset = () => setForm(editing ?? { currency: "INR", spent_on: new Date().toISOString().slice(0, 10), amount: 0 });
  useEffect(() => { if (open) reset(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open, editing]);

  const isEdit = !!editing;
  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form }; delete payload.id;
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
