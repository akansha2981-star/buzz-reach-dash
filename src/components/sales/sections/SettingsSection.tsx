import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Copy, History, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getRazorpayHealth } from "@/lib/sales-integration.functions";
import { importRazorpayHistory } from "@/lib/sales-backfill.functions";
import { inr, useCourses, useSalesSettings, useWebsites, type SalesSettings } from "@/lib/sales";
import { EmptyState, SectionCard } from "@/components/sales/SalesUI";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


export function SettingsSection() {
  const qc = useQueryClient();
  const { data: settings } = useSalesSettings();
  const { data: websites = [] } = useWebsites();
  const { data: courses = [] } = useCourses();
  const health = useServerFn(getRazorpayHealth);
  const { data: rzp } = useQuery({ queryKey: ["sales", "razorpay-health"], queryFn: () => health() });

  const { data: logs = [] } = useQuery({
    queryKey: ["sales", "webhook-logs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sales_webhook_logs")
        .select("id, event_type, status, message, created_at").order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/public/razorpay-webhook` : "";

  const [form, setForm] = useState<Partial<SalesSettings>>({});
  useEffect(() => { if (settings) setForm(settings); }, [settings]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      if (!settings) return;
      const { error } = await supabase.from("sales_settings").update({
        gateway_fee_percent: Number(form.gateway_fee_percent) || 0,
        gateway_fee_gst_percent: Number(form.gateway_fee_gst_percent) || 0,
        default_tax_percent: Number(form.default_tax_percent) || 0,
        default_unit_cost: Number(form.default_unit_cost) || 0,
        daily_revenue_target: Number(form.daily_revenue_target) || 0,
        daily_profit_target: Number(form.daily_profit_target) || 0,
        daily_ad_spend_limit: Number(form.daily_ad_spend_limit) || 0,
        daily_sales_target: Number(form.daily_sales_target) || 0,
        monthly_revenue_target: Number(form.monthly_revenue_target) || 0,
        monthly_profit_target: Number(form.monthly_profit_target) || 0,
        total_sales_target: Number(form.total_sales_target) || 0,
        total_revenue_target: Number(form.total_revenue_target) || 0,
        total_profit_target: Number(form.total_profit_target) || 0,
      }).eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Settings saved"); qc.invalidateQueries({ queryKey: ["sales"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const runHistory = useServerFn(importRazorpayHistory);
  const [bf, setBf] = useState(() => {
    const to = new Date();
    const from = new Date(Date.now() - 30 * 86400000);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  });
  const runImport = useMutation({
    mutationFn: () => runHistory({ data: { from: bf.from, to: bf.to } }),
    onSuccess: (r) => {
      toast.success(r.paymentsStored > 0 ? r.message : "No transactions found in that date range");
      if (r.truncated) toast.info("A lot of data in this range — import it in smaller stretches to be sure everything came through.");
      qc.invalidateQueries({ queryKey: ["sales"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [siteName, setSiteName] = useState("");
  const [siteDomain, setSiteDomain] = useState("");
  const addSite = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sales_websites").insert({ name: siteName.trim(), domain: siteDomain.trim() || null });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Website added"); setSiteName(""); setSiteDomain(""); qc.invalidateQueries({ queryKey: ["sales"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delSite = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("sales_websites").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales"] }),
  });

  const [course, setCourse] = useState({ name: "", code: "", list_price: "", unit_cost: "" });
  const addCourse = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sales_courses").insert({
        name: course.name.trim(), code: course.code.trim() || null,
        list_price: Number(course.list_price) || 0, unit_cost: Number(course.unit_cost) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Course added"); setCourse({ name: "", code: "", list_price: "", unit_cost: "" }); qc.invalidateQueries({ queryKey: ["sales"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updCourse = useMutation({
    mutationFn: async ({ id, unit_cost }: { id: string; unit_cost: number }) => {
      const { error } = await supabase.from("sales_courses").update({ unit_cost }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Course cost updated"); qc.invalidateQueries({ queryKey: ["sales"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delCourse = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("sales_courses").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sales"] }),
  });

  const ready = rzp?.webhookSecretConfigured;

  return (
    <div className="space-y-4">
      <SectionCard title="Razorpay integration" subtitle="Payments flow in automatically through a signed webhook">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {ready ? (
              <Badge className="gap-1 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10">
                <CheckCircle2 className="h-3.5 w-3.5" />Webhook secret configured
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" />Webhook secret missing
              </Badge>
            )}
            <Badge variant="outline" className="capitalize">Mode: {rzp?.mode ?? "…"}</Badge>
            {rzp?.keyIdConfigured && <Badge variant="outline">Key ID: {rzp.keyIdMasked}</Badge>}
          </div>

          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Webhook URL — paste this in Razorpay → Settings → Webhooks</Label>
            <div className="flex gap-2">
              <Input readOnly value={webhookUrl} className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => { void navigator.clipboard.writeText(webhookUrl); toast.success("Copied"); }}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">Events to enable</p>
            <p>payment.captured, payment.authorized, payment.failed, refund.created, refund.processed</p>
            <p className="mt-2 font-medium text-foreground">Recommended payment notes (for richer analytics)</p>
            <p>course / course_id, website, name, utm_source, utm_medium, utm_campaign, utm_content, utm_term, coupon_code, discount, tax</p>
            <p className="mt-2">Every webhook is signature-verified and processed once — duplicate deliveries are ignored automatically.</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Import past sales from Razorpay" subtitle="One-time backfill — pulls historical payments and refunds directly from your Razorpay account">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">From</Label>
            <Input type="date" value={bf.from} onChange={(e) => setBf((s) => ({ ...s, from: e.target.value }))} className="w-[160px]" />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">To</Label>
            <Input type="date" value={bf.to} onChange={(e) => setBf((s) => ({ ...s, to: e.target.value }))} className="w-[160px]" />
          </div>
          <Button onClick={() => runImport.mutate()} disabled={runImport.isPending || !rzp?.keySecretConfigured}>
            <History className="mr-1.5 h-4 w-4" />
            {runImport.isPending ? "Importing…" : "Import history"}
          </Button>
          {[30, 90, 365].map((d) => (
            <Button key={d} size="sm" variant="outline" onClick={() => {
              const to = new Date();
              const from = new Date(Date.now() - d * 86400000);
              setBf({ from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) });
            }}>
              Last {d === 365 ? "1 year" : `${d} days`}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Safe to run more than once — each payment and refund is matched on its Razorpay ID, so nothing is ever duplicated.
          Import in stretches of up to a year at a time; missing courses and websites are created automatically from payment notes.
        </p>
        {!rzp?.keySecretConfigured && (
          <p className="mt-2 text-xs text-amber-700">Add your Razorpay API keys first — the import needs them to read past transactions.</p>
        )}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Profit calculation rules" subtitle="Gateway fees, tax and default cost">
          <div className="grid gap-3 sm:grid-cols-2">
            <NumField label="Gateway fee (%)" value={form.gateway_fee_percent} onChange={(v) => setForm((s) => ({ ...s, gateway_fee_percent: v }))} />
            <NumField label="GST on gateway fee (%)" value={form.gateway_fee_gst_percent} onChange={(v) => setForm((s) => ({ ...s, gateway_fee_gst_percent: v }))} />
            <NumField label="Default tax (%)" value={form.default_tax_percent} onChange={(v) => setForm((s) => ({ ...s, default_tax_percent: v }))} />
            <NumField label="Default product cost (₹)" value={form.default_unit_cost} onChange={(v) => setForm((s) => ({ ...s, default_unit_cost: v }))} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Example: a {inr(1000)} payment at {form.gateway_fee_percent ?? 0}% + {form.gateway_fee_gst_percent ?? 0}% GST costs{" "}
            {inr(((1000 * (Number(form.gateway_fee_percent) || 0)) / 100) * (1 + (Number(form.gateway_fee_gst_percent) || 0) / 100))}.
          </p>
        </SectionCard>

        <SectionCard title="Targets" subtitle="Daily and monthly goals shown on the overview">
          <div className="grid gap-3 sm:grid-cols-2">
            <NumField label="Daily revenue target (₹)" value={form.daily_revenue_target} onChange={(v) => setForm((s) => ({ ...s, daily_revenue_target: v }))} />
            <NumField label="Daily profit target (₹)" value={form.daily_profit_target} onChange={(v) => setForm((s) => ({ ...s, daily_profit_target: v }))} />
            <NumField label="Daily ad spend limit (₹)" value={form.daily_ad_spend_limit} onChange={(v) => setForm((s) => ({ ...s, daily_ad_spend_limit: v }))} />
            <NumField label="Daily sales target" value={form.daily_sales_target} onChange={(v) => setForm((s) => ({ ...s, daily_sales_target: v }))} />
            <NumField label="Monthly revenue target (₹)" value={form.monthly_revenue_target} onChange={(v) => setForm((s) => ({ ...s, monthly_revenue_target: v }))} />
            <NumField label="Monthly profit target (₹)" value={form.monthly_profit_target} onChange={(v) => setForm((s) => ({ ...s, monthly_profit_target: v }))} />
            <NumField label="Total sales target (overall)" value={form.total_sales_target} onChange={(v) => setForm((s) => ({ ...s, total_sales_target: v }))} />
            <NumField label="Total gross revenue target (₹)" value={form.total_revenue_target} onChange={(v) => setForm((s) => ({ ...s, total_revenue_target: v }))} />
            <NumField label="Total net profit target (₹)" value={form.total_profit_target} onChange={(v) => setForm((s) => ({ ...s, total_profit_target: v }))} />
          </div>
        </SectionCard>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
          {saveSettings.isPending ? "Saving…" : "Save settings"}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Connected websites" subtitle="Multiple sites can feed the same tracker">
          <div className="flex flex-wrap gap-2">
            <Input className="min-w-[140px] flex-1" placeholder="Website name" value={siteName} onChange={(e) => setSiteName(e.target.value)} />
            <Input className="min-w-[140px] flex-1" placeholder="domain.com" value={siteDomain} onChange={(e) => setSiteDomain(e.target.value)} />
            <Button size="sm" onClick={() => addSite.mutate()} disabled={!siteName.trim() || addSite.isPending}>
              <Plus className="mr-1.5 h-4 w-4" />Add
            </Button>
          </div>
          {websites.length === 0 ? <EmptyState title="No websites added yet" hint="Websites are also created automatically from payment notes." /> : (
            <ul className="mt-3 divide-y divide-border/50">
              {websites.map((w) => (
                <li key={w.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">{w.name}</p>
                    <p className="text-xs text-muted-foreground">{w.domain ?? "—"}</p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => delSite.mutate(w.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Courses & product cost" subtitle="Direct cost per sale drives gross profit">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input placeholder="Course name" value={course.name} onChange={(e) => setCourse((s) => ({ ...s, name: e.target.value }))} />
            <Input placeholder="Code (optional)" value={course.code} onChange={(e) => setCourse((s) => ({ ...s, code: e.target.value }))} />
            <Input type="number" placeholder="List price ₹" value={course.list_price} onChange={(e) => setCourse((s) => ({ ...s, list_price: e.target.value }))} />
            <Input type="number" placeholder="Unit cost ₹" value={course.unit_cost} onChange={(e) => setCourse((s) => ({ ...s, unit_cost: e.target.value }))} />
          </div>
          <Button size="sm" className="mt-2" onClick={() => addCourse.mutate()} disabled={!course.name.trim() || addCourse.isPending}>
            <Plus className="mr-1.5 h-4 w-4" />Add course
          </Button>
          {courses.length === 0 ? <EmptyState title="No courses yet" hint="Courses are created automatically from payment notes too." /> : (
            <ul className="mt-3 divide-y divide-border/50">
              {courses.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">List {inr(c.list_price)} · {c.code ?? "no code"}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Input type="number" defaultValue={c.unit_cost} className="h-8 w-24"
                      onBlur={(e) => {
                        const v = Number(e.target.value) || 0;
                        if (v !== c.unit_cost) updCourse.mutate({ id: c.id, unit_cost: v });
                      }} />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => delCourse.mutate(c.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Webhook logs" subtitle="Integration health — last 30 events">
        {logs.length === 0 ? <EmptyState title="No webhook activity yet" hint="Logs appear as soon as Razorpay starts delivering events." /> : (
          <ul className="divide-y divide-border/50 text-sm">
            {logs.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{l.event_type ?? "unknown event"}</p>
                  <p className="truncate text-xs text-muted-foreground">{l.message}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={String(l.status).includes("error") ? "destructive" : "secondary"} className="text-[10px]">{l.status}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number | undefined; onChange: (v: number) => void }) {
  return (
    <div>
      <Label className="mb-1 block text-xs text-muted-foreground">{label}</Label>
      <Input type="number" value={value ?? 0} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
