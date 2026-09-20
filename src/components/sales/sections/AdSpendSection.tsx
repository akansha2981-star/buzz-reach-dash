import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  AD_PLATFORMS, campaignPacing, filterAdSpend, inr, num, resolveRange, useAdSpend,
  useCampaigns, useCourses, useWebsites, ymd, type SalesAdSpend,
} from "@/lib/sales";
import { EmptyState, KpiCard, ProgressBar, SectionCard, useSalesFilters } from "@/components/sales/SalesUI";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";


type Form = {
  spend_date: string; platform: string; campaign_name: string; campaign_ref: string;
  ad_set: string; ad_name: string; website_id: string; course_id: string; objective: string;
  amount: string; budget_mode: "total" | "daily"; budget: string; duration_days: string;
  start_date: string; end_date: string; notes: string;
};

const emptyForm = (): Form => ({
  spend_date: ymd(new Date()), platform: "Meta Ads", campaign_name: "", campaign_ref: "",
  ad_set: "", ad_name: "", website_id: "none", course_id: "none", objective: "",
  amount: "", budget_mode: "total", budget: "", duration_days: "1",
  start_date: ymd(new Date()), end_date: "", notes: "",
});

export function AdSpendSection() {
  const f = useSalesFilters();
  const qc = useQueryClient();
  const { data: spend = [] } = useAdSpend();
  const { data: campaigns = [] } = useCampaigns();
  const { data: websites = [] } = useWebsites();
  const { data: courses = [] } = useCourses();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm());

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((s) => ({ ...s, [k]: v }));

  const planned = useMemo(() => {
    const b = Number(form.budget) || 0;
    const d = Math.max(1, Number(form.duration_days) || 1);
    return form.budget_mode === "daily" ? { total: b * d, perDay: b } : { total: b, perDay: b / d };
  }, [form.budget, form.duration_days, form.budget_mode]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      let campaignId: string | null = null;
      if (form.campaign_name.trim()) {
        const existing = campaigns.find((c) => c.name.toLowerCase() === form.campaign_name.trim().toLowerCase());
        if (existing) campaignId = existing.id;
        else {
          const { data, error } = await supabase.from("sales_ad_campaigns").insert({
            name: form.campaign_name.trim(),
            campaign_ref: form.campaign_ref || null,
            platform: form.platform,
            objective: form.objective || null,
            website_id: form.website_id === "none" ? null : form.website_id,
            course_id: form.course_id === "none" ? null : form.course_id,
            budget_mode: form.budget_mode,
            total_budget: form.budget_mode === "total" ? Number(form.budget) || 0 : planned.total,
            daily_budget: form.budget_mode === "daily" ? Number(form.budget) || 0 : planned.perDay,
            duration_days: Math.max(1, Number(form.duration_days) || 1),
            start_date: form.start_date || null,
            end_date: form.end_date || null,
            notes: form.notes || null,
            created_by: user?.id ?? null,
          }).select("id").single();
          if (error) throw error;
          campaignId = data.id;
        }
      }
      const { error } = await supabase.from("sales_ad_spend").insert({
        campaign_id: campaignId,
        campaign_name: form.campaign_name.trim() || null,
        platform: form.platform,
        ad_set: form.ad_set || null,
        ad_name: form.ad_name || null,
        website_id: form.website_id === "none" ? null : form.website_id,
        course_id: form.course_id === "none" ? null : form.course_id,
        objective: form.objective || null,
        spend_date: form.spend_date,
        amount: Number(form.amount) || 0,
        budget_mode: form.budget_mode,
        budget: Number(form.budget) || 0,
        duration_days: Math.max(1, Number(form.duration_days) || 1),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        notes: form.notes || null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ad spend added");
      qc.invalidateQueries({ queryKey: ["sales"] });
      setForm(emptyForm());
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales_ad_spend").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Entry removed"); qc.invalidateQueries({ queryKey: ["sales"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const today = ymd(new Date());
  const sum = (rows: SalesAdSpend[]) => rows.reduce((s, a) => s + (a.amount || 0), 0);
  const inRangeRows = filterAdSpend(spend, f.filters);
  const week = resolveRange("7d");
  const month = resolveRange("this_month");

  const daily = useMemo(() => {
    const map = new Map<string, number>();
    inRangeRows.forEach((r) => map.set(r.spend_date, (map.get(r.spend_date) ?? 0) + (r.amount || 0)));
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, amount]) => ({ date, amount }));
  }, [inRangeRows]);

  return (
    <div className="space-y-4">

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Today's ad spend" value={sum(filterAdSpend(spend, { ...f.filters, from: today, to: today }))} format={(n) => inr(n)} accent="primary" />
        <KpiCard label="This week" value={sum(filterAdSpend(spend, { ...f.filters, from: week.from, to: week.to }))} format={(n) => inr(n)} />
        <KpiCard label="This month" value={sum(filterAdSpend(spend, { ...f.filters, from: month.from, to: month.to }))} format={(n) => inr(n)} />
        <KpiCard label="Overall" value={sum(spend)} format={(n) => inr(n)} />
      </div>

      <SectionCard
        title="Ad spend entries"
        subtitle={`${num(inRangeRows.length)} entries · ${inr(sum(inRangeRows))} in range`}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-1.5 h-4 w-4" />Add ad spend</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader><DialogTitle>Add ad spend</DialogTitle></DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Date"><Input type="date" value={form.spend_date} onChange={(e) => set("spend_date", e.target.value)} /></Field>
                <Field label="Platform">
                  <Select value={form.platform} onValueChange={(v) => set("platform", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{AD_PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Campaign name"><Input value={form.campaign_name} onChange={(e) => set("campaign_name", e.target.value)} placeholder="CAT September Campaign" /></Field>
                <Field label="Campaign ID"><Input value={form.campaign_ref} onChange={(e) => set("campaign_ref", e.target.value)} /></Field>
                <Field label="Ad set"><Input value={form.ad_set} onChange={(e) => set("ad_set", e.target.value)} /></Field>
                <Field label="Ad name"><Input value={form.ad_name} onChange={(e) => set("ad_name", e.target.value)} /></Field>
                <Field label="Website">
                  <Select value={form.website_id} onValueChange={(v) => set("website_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not linked</SelectItem>
                      {websites.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Course / product">
                  <Select value={form.course_id} onValueChange={(v) => set("course_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not linked</SelectItem>
                      {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Objective"><Input value={form.objective} onChange={(e) => set("objective", e.target.value)} placeholder="Conversions" /></Field>
                <Field label="Amount spent (₹)"><Input type="number" value={form.amount} onChange={(e) => set("amount", e.target.value)} /></Field>
                <Field label="Budget mode">
                  <Select value={form.budget_mode} onValueChange={(v) => set("budget_mode", v as "total" | "daily")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="total">Total budget</SelectItem>
                      <SelectItem value="daily">Daily budget</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={form.budget_mode === "daily" ? "Daily budget (₹)" : "Total budget (₹)"}>
                  <Input type="number" value={form.budget} onChange={(e) => set("budget", e.target.value)} />
                </Field>
                <Field label="Duration (days)"><Input type="number" min={1} value={form.duration_days} onChange={(e) => set("duration_days", e.target.value)} /></Field>
                <Field label="Start date"><Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} /></Field>
                <Field label="End date"><Input type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} /></Field>
                <div className="sm:col-span-2">
                  <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-xs sm:col-span-2">
                  <p className="font-medium">Planned spend</p>
                  <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <span>Total: <strong className="tabular-nums">{inr(planned.total)}</strong></span>
                    <span>Daily average: <strong className="tabular-nums">{inr(planned.perDay)}/day</strong></span>
                    <span>Duration: <strong>{Math.max(1, Number(form.duration_days) || 1)} day(s)</strong></span>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => save.mutate()} disabled={save.isPending || !form.amount}>
                  {save.isPending ? "Saving…" : "Save ad spend"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      >
        {inRangeRows.length === 0 ? (
          <EmptyState title="No ad spend in this range" hint="Add your advertising expenditure to unlock ROAS, CAC and net profit." />
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[780px] text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Platform</th><th className="py-2 pr-3">Campaign</th>
                  <th className="py-2 pr-3">Ad set / ad</th><th className="py-2 pr-3">Course</th>
                  <th className="py-2 pr-3 text-right">Amount</th><th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {inRangeRows.map((r) => (
                  <tr key={r.id} className="border-b border-border/40 last:border-0">
                    <td className="py-2.5 pr-3 whitespace-nowrap text-xs">{r.spend_date}</td>
                    <td className="py-2.5 pr-3 text-xs">{r.platform}</td>
                    <td className="py-2.5 pr-3 font-medium">{r.campaign_name ?? "—"}</td>
                    <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                      {[r.ad_set, r.ad_name].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-xs">{courses.find((c) => c.id === r.course_id)?.name ?? "—"}</td>
                    <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">{inr(r.amount)}</td>
                    <td className="py-2.5 text-right">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => del.mutate(r.id)}>
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

      <SectionCard title="Daily spend" subtitle="Spend distribution across the selected range">
        {daily.length === 0 ? <EmptyState title="Nothing to chart yet" /> : (
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} margin={{ left: -12, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => inr(v, true)} />
                <Tooltip formatter={(v: number) => inr(v)} />
                <Bar dataKey="amount" name="Ad spend" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Campaign budgets" subtitle="Budget utilisation and pacing">
        {campaigns.length === 0 ? <EmptyState title="No campaigns yet" hint="Campaigns are created automatically when you add ad spend with a campaign name." /> : (
          <div className="grid gap-3 md:grid-cols-2">
            {campaigns.map((c) => {
              const spent = spend.filter((s) => s.campaign_id === c.id).reduce((s, a) => s + (a.amount || 0), 0);
              const p = campaignPacing(c, spent);
              return (
                <div key={c.id} className="rounded-xl border border-border/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.platform} · {c.duration_days} day(s)</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{inr(p.planned)}</span>
                  </div>
                  <div className="mt-2"><ProgressBar value={p.utilized} tone={p.utilized > 100 ? "danger" : "primary"} /></div>
                  <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-muted-foreground sm:grid-cols-4">
                    <span>Spent: <strong className="text-foreground tabular-nums">{inr(p.spent)}</strong></span>
                    <span>Remaining: <strong className="text-foreground tabular-nums">{inr(p.remaining)}</strong></span>
                    <span>Daily avg: <strong className="text-foreground tabular-nums">{inr(p.dailyAvg)}</strong></span>
                    <span>Utilised: <strong className="text-foreground tabular-nums">{p.utilized.toFixed(0)}%</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
