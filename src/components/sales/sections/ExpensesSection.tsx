import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  EXPENSE_CATEGORIES, inr, num, useCourses, useSalesExpenses, useSalesSettings, useWebsites, ymd,
} from "@/lib/sales";
import { EmptyState, KpiCard, SalesFilterBar, SectionCard, useSalesFilters } from "@/components/sales/SalesUI";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";


const PIE = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#6366f1", "#ec4899", "#14b8a6", "#ef4444", "#8b5cf6", "#0ea5e9", "#84cc16"];

export function ExpensesSection() {
  const f = useSalesFilters();
  const qc = useQueryClient();
  const { data: expenses = [] } = useSalesExpenses();
  const { data: settings } = useSalesSettings();
  const { data: websites = [] } = useWebsites();
  const { data: courses = [] } = useCourses();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", category: "Software", amount: "", spent_on: ymd(new Date()),
    website_id: "none", course_id: "none", notes: "",
  });

  const categories = settings?.expense_categories?.length ? settings.expense_categories : [...EXPENSE_CATEGORIES];

  const rows = useMemo(() => expenses.filter((e) => {
    if (e.spent_on < f.from || e.spent_on > f.to) return false;
    if (f.websiteId !== "all" && e.website_id !== f.websiteId) return false;
    if (f.courseId !== "all" && e.course_id !== f.courseId) return false;
    return true;
  }), [expenses, f.from, f.to, f.websiteId, f.courseId]);

  const total = rows.reduce((s, e) => s + (e.amount || 0), 0);
  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((e) => m.set(e.category, (m.get(e.category) ?? 0) + (e.amount || 0)));
    return Array.from(m.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [rows]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("sales_expenses").insert({
        title: form.title.trim(),
        category: form.category,
        amount: Number(form.amount) || 0,
        spent_on: form.spent_on,
        website_id: form.website_id === "none" ? null : form.website_id,
        course_id: form.course_id === "none" ? null : form.course_id,
        notes: form.notes || null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Expense added");
      qc.invalidateQueries({ queryKey: ["sales"] });
      setForm({ title: "", category: "Software", amount: "", spent_on: ymd(new Date()), website_id: "none", course_id: "none", notes: "" });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Expense removed"); qc.invalidateQueries({ queryKey: ["sales"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <SalesFilterBar />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Expenses in range" value={total} format={(n) => inr(n)} accent="warning" />
        <KpiCard label="Entries" value={rows.length} format={(n) => num(n)} />
        <KpiCard label="Categories used" value={byCat.length} format={(n) => num(n)} />
        <KpiCard label="Avg per entry" value={rows.length ? total / rows.length : 0} format={(n) => inr(n)} />
      </div>

      <SectionCard
        title="Other business expenses"
        subtitle="Deducted from net profit alongside ad spend and gateway fees"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="mr-1.5 h-4 w-4" />Add expense</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader><DialogTitle>Add expense</DialogTitle></DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label className="mb-1 block text-xs text-muted-foreground">Title</Label>
                  <Input value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} placeholder="Zoom subscription" />
                </div>
                <div>
                  <Label className="mb-1 block text-xs text-muted-foreground">Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm((s) => ({ ...s, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1 block text-xs text-muted-foreground">Amount (₹)</Label>
                  <Input type="number" value={form.amount} onChange={(e) => setForm((s) => ({ ...s, amount: e.target.value }))} />
                </div>
                <div>
                  <Label className="mb-1 block text-xs text-muted-foreground">Date</Label>
                  <Input type="date" value={form.spent_on} onChange={(e) => setForm((s) => ({ ...s, spent_on: e.target.value }))} />
                </div>
                <div>
                  <Label className="mb-1 block text-xs text-muted-foreground">Website</Label>
                  <Select value={form.website_id} onValueChange={(v) => setForm((s) => ({ ...s, website_id: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not linked</SelectItem>
                      {websites.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label className="mb-1 block text-xs text-muted-foreground">Course / product (optional)</Label>
                  <Select value={form.course_id} onValueChange={(v) => setForm((s) => ({ ...s, course_id: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not linked</SelectItem>
                      {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label className="mb-1 block text-xs text-muted-foreground">Notes</Label>
                  <Textarea rows={2} value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => save.mutate()} disabled={save.isPending || !form.title || !form.amount}>
                  {save.isPending ? "Saving…" : "Save expense"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      >
        {rows.length === 0 ? <EmptyState title="No expenses in this range" hint="Add software, salaries, hosting and other running costs to get a true net profit." /> : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Title</th><th className="py-2 pr-3">Category</th>
                  <th className="py-2 pr-3">Website</th><th className="py-2 pr-3 text-right">Amount</th><th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2.5 pr-3 whitespace-nowrap text-xs">{e.spent_on}</td>
                    <td className="py-2.5 pr-3 font-medium">{e.title}</td>
                    <td className="py-2.5 pr-3 text-xs">{e.category}</td>
                    <td className="py-2.5 pr-3 text-xs">{websites.find((w) => w.id === e.website_id)?.name ?? "—"}</td>
                    <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">{inr(e.amount)}</td>
                    <td className="py-2.5 text-right">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => del.mutate(e.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {byCat.length > 0 && (
        <SectionCard title="Expense distribution" subtitle="By category">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byCat} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2} label={false}>
                  {byCat.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => inr(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {byCat.map((c, i) => (
              <span key={c.name} className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2 py-0.5">
                <span className="h-2 w-2 rounded-full" style={{ background: PIE[i % PIE.length] }} />
                {c.name} · <strong className="tabular-nums">{inr(c.value)}</strong>
              </span>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
