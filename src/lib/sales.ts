import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/* ============================ Types ============================ */

export type SalesWebsite = {
  id: string; name: string; domain: string | null; is_active: boolean;
};

export type SalesCourse = {
  id: string; name: string; code: string | null; website_id: string | null;
  list_price: number; unit_cost: number; category: string | null; is_active: boolean;
};

export type SalesPayment = {
  id: string;
  razorpay_payment_id: string;
  razorpay_order_id: string | null;
  website_id: string | null;
  course_id: string | null;
  product_name: string | null;
  product_ref: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  amount: number;
  discount: number;
  tax: number;
  final_amount: number;
  currency: string;
  payment_method: string | null;
  status: string;
  gateway_fee: number;
  refund_status: string | null;
  refund_amount: number;
  coupon_code: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  paid_at: string;
  created_at: string;
  is_test?: boolean | null;
};

export type SalesRefund = {
  id: string; razorpay_refund_id: string; payment_id: string | null;
  razorpay_payment_id: string | null; amount: number; is_partial: boolean;
  reason: string | null; refunded_at: string;
};

export type SalesAdSpend = {
  id: string; campaign_id: string | null; campaign_name: string | null;
  platform: string; ad_set: string | null; ad_name: string | null;
  website_id: string | null; course_id: string | null; objective: string | null;
  spend_date: string; amount: number; budget_mode: string; budget: number;
  duration_days: number; start_date: string | null; end_date: string | null;
  notes: string | null;
};

export type SalesCampaign = {
  id: string; name: string; campaign_ref: string | null; platform: string;
  objective: string | null; website_id: string | null; course_id: string | null;
  budget_mode: string; total_budget: number; daily_budget: number;
  duration_days: number; start_date: string | null; end_date: string | null;
  is_active: boolean; notes: string | null;
};

export type SalesExpense = {
  id: string; title: string; category: string; amount: number; spent_on: string;
  website_id: string | null; course_id: string | null; notes: string | null;
};

export type SalesSettings = {
  id: string;
  gateway_fee_percent: number;
  gateway_fee_gst_percent: number;
  default_tax_percent: number;
  default_unit_cost: number;
  daily_revenue_target: number;
  daily_profit_target: number;
  daily_ad_spend_limit: number;
  daily_sales_target: number;
  monthly_revenue_target: number;
  monthly_profit_target: number;
  total_sales_target: number;
  total_revenue_target: number;
  total_profit_target: number;
  expense_categories: string[];
};

export const AD_PLATFORMS = ["Meta Ads", "Google Ads", "YouTube Ads", "LinkedIn Ads", "Other"] as const;
export const EXPENSE_CATEGORIES = [
  "Software", "Salaries", "Freelancers", "Hosting", "Content",
  "Design", "Marketing", "Operations", "Miscellaneous", "Other",
] as const;

export const SUCCESS_STATUSES = ["captured", "authorized", "partially_refunded", "refunded"];

/* ============================ Formatting ============================ */

export const inr = (n: number, compact = false) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? "compact" : "standard",
  }).format(Number.isFinite(n) ? n : 0);

export const num = (n: number, d = 0) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: d }).format(Number.isFinite(n) ? n : 0);

export const pct = (n: number, d = 1) => `${Number.isFinite(n) ? n.toFixed(d) : "0.0"}%`;

export const ymd = (d: Date) => {
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/* ============================ Date ranges ============================ */

export type RangeKey =
  | "today" | "yesterday" | "7d" | "30d" | "this_month" | "last_month"
  | "this_quarter" | "this_year" | "all" | "custom";

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "this_quarter", label: "This Quarter" },
  { key: "this_year", label: "This Year" },
  { key: "all", label: "All Time" },
  { key: "custom", label: "Custom Range" },
];

export function resolveRange(key: RangeKey, customFrom?: string, customTo?: string): { from: string; to: string } {
  const now = new Date();
  const today = ymd(now);
  switch (key) {
    case "today": return { from: today, to: today };
    case "yesterday": { const y = ymd(addDays(now, -1)); return { from: y, to: y }; }
    case "7d": return { from: ymd(addDays(now, -6)), to: today };
    case "30d": return { from: ymd(addDays(now, -29)), to: today };
    case "this_month": return { from: ymd(startOfMonth(now)), to: today };
    case "last_month": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: ymd(s), to: ymd(e) };
    }
    case "this_quarter": {
      const q = Math.floor(now.getMonth() / 3);
      return { from: ymd(new Date(now.getFullYear(), q * 3, 1)), to: today };
    }
    case "this_year": return { from: ymd(new Date(now.getFullYear(), 0, 1)), to: today };
    case "all": return { from: "2000-01-01", to: today };
    case "custom": return { from: customFrom || today, to: customTo || today };
  }
}

export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  const s = new Date(`${from}T00:00:00`);
  const e = new Date(`${to}T00:00:00`);
  for (let d = s; d <= e; d = addDays(d, 1)) out.push(ymd(d));
  return out;
}

/* ============================ Data hooks ============================ */

export const SALES_KEYS = {
  settings: ["sales", "settings"],
  websites: ["sales", "websites"],
  courses: ["sales", "courses"],
  campaigns: ["sales", "campaigns"],
  payments: ["sales", "payments"],
  refunds: ["sales", "refunds"],
  adSpend: ["sales", "ad-spend"],
  expenses: ["sales", "expenses"],
  logs: ["sales", "webhook-logs"],
};

export function useSalesSettings() {
  return useQuery({
    queryKey: SALES_KEYS.settings,
    queryFn: async (): Promise<SalesSettings | null> => {
      const { data, error } = await supabase.from("sales_settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return (data as unknown as SalesSettings) ?? null;
    },
    staleTime: 60_000,
  });
}

export function useWebsites() {
  return useQuery({
    queryKey: SALES_KEYS.websites,
    queryFn: async () => {
      const { data, error } = await supabase.from("sales_websites").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as unknown as SalesWebsite[];
    },
    staleTime: 60_000,
  });
}

export function useCourses() {
  return useQuery({
    queryKey: SALES_KEYS.courses,
    queryFn: async () => {
      const { data, error } = await supabase.from("sales_courses").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as unknown as SalesCourse[];
    },
    staleTime: 60_000,
  });
}

export function useCampaigns() {
  return useQuery({
    queryKey: SALES_KEYS.campaigns,
    queryFn: async () => {
      const { data, error } = await supabase.from("sales_ad_campaigns").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SalesCampaign[];
    },
    staleTime: 60_000,
  });
}

/** All payments (bounded) — aggregation happens client-side for instant filtering. */
export function usePayments() {
  return useQuery({
    queryKey: SALES_KEYS.payments,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_payments").select("*").order("paid_at", { ascending: false }).limit(5000);
      if (error) throw error;
      return (data ?? []) as unknown as SalesPayment[];
    },
    staleTime: 15_000,
  });
}

export function useRefunds() {
  return useQuery({
    queryKey: SALES_KEYS.refunds,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_refunds").select("*").order("refunded_at", { ascending: false }).limit(2000);
      if (error) throw error;
      return (data ?? []) as unknown as SalesRefund[];
    },
    staleTime: 30_000,
  });
}

export function useAdSpend() {
  return useQuery({
    queryKey: SALES_KEYS.adSpend,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_ad_spend").select("*").order("spend_date", { ascending: false }).limit(5000);
      if (error) throw error;
      return (data ?? []) as unknown as SalesAdSpend[];
    },
    staleTime: 30_000,
  });
}

export function useSalesExpenses() {
  return useQuery({
    queryKey: SALES_KEYS.expenses,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_expenses").select("*").order("spent_on", { ascending: false }).limit(3000);
      if (error) throw error;
      return (data ?? []) as unknown as SalesExpense[];
    },
    staleTime: 30_000,
  });
}

/* ============================ Profit engine ============================ */

export type Filters = {
  from: string;
  to: string;
  websiteId?: string | "all";
  courseId?: string | "all";
  campaign?: string | "all";
};

export type Metrics = {
  grossRevenue: number;
  refunds: number;
  netRevenue: number;
  productCost: number;
  grossProfit: number;
  adSpend: number;
  gatewayFees: number;
  otherExpenses: number;
  netProfit: number;
  sales: number;
  orders: number;
  customers: number;
  aov: number;
  roas: number;
  roi: number;
  cac: number;
  costPerSale: number;
  profitMargin: number;
  refundRate: number;
  totalCost: number;
};

const inRange = (dateStr: string, from: string, to: string) => {
  const d = dateStr.slice(0, 10);
  return d >= from && d <= to;
};

export function gatewayFeeFor(amount: number, s: SalesSettings | null | undefined) {
  if (!s) return 0;
  const base = (amount * (s.gateway_fee_percent || 0)) / 100;
  return base * (1 + (s.gateway_fee_gst_percent || 0) / 100);
}

export function filterPayments(rows: SalesPayment[], f: Filters) {
  return rows.filter((p) => {
    if (!inRange(p.paid_at, f.from, f.to)) return false;
    if (f.websiteId && f.websiteId !== "all" && p.website_id !== f.websiteId) return false;
    if (f.courseId && f.courseId !== "all" && p.course_id !== f.courseId) return false;
    if (f.campaign && f.campaign !== "all" && (p.utm_campaign ?? "") !== f.campaign) return false;
    return true;
  });
}

export function filterAdSpend(rows: SalesAdSpend[], f: Filters) {
  return rows.filter((a) => {
    if (!inRange(a.spend_date, f.from, f.to)) return false;
    if (f.websiteId && f.websiteId !== "all" && a.website_id !== f.websiteId) return false;
    if (f.courseId && f.courseId !== "all" && a.course_id !== f.courseId) return false;
    if (f.campaign && f.campaign !== "all" && (a.campaign_name ?? "") !== f.campaign) return false;
    return true;
  });
}

export function computeMetrics(args: {
  payments: SalesPayment[];
  adSpend: SalesAdSpend[];
  expenses: SalesExpense[];
  courses: SalesCourse[];
  settings: SalesSettings | null | undefined;
  filters: Filters;
}): Metrics {
  const { settings, filters } = args;
  const pays = filterPayments(args.payments, filters).filter((p) => SUCCESS_STATUSES.includes(p.status));
  const spends = filterAdSpend(args.adSpend, filters);
  const exps = args.expenses.filter((e) => {
    if (!inRange(e.spent_on, filters.from, filters.to)) return false;
    if (filters.websiteId && filters.websiteId !== "all" && e.website_id !== filters.websiteId) return false;
    if (filters.courseId && filters.courseId !== "all" && e.course_id !== filters.courseId) return false;
    return true;
  });

  const costByCourse = new Map(args.courses.map((c) => [c.id, c.unit_cost || 0]));
  const defaultCost = settings?.default_unit_cost ?? 0;

  const grossRevenue = pays.reduce((s, p) => s + (p.final_amount || 0), 0);
  const refunds = pays.reduce((s, p) => s + (p.refund_amount || 0), 0);
  const netRevenue = grossRevenue - refunds;
  const productCost = pays.reduce(
    (s, p) => s + (p.course_id ? (costByCourse.get(p.course_id) ?? defaultCost) : defaultCost), 0);
  const grossProfit = netRevenue - productCost;
  const adSpend = spends.reduce((s, a) => s + (a.amount || 0), 0);
  const gatewayFees = pays.reduce(
    (s, p) => s + (p.gateway_fee > 0 ? p.gateway_fee : gatewayFeeFor(p.final_amount || 0, settings)), 0);
  const otherExpenses = exps.reduce((s, e) => s + (e.amount || 0), 0);
  const netProfit = grossProfit - adSpend - gatewayFees - otherExpenses;

  const sales = pays.length;
  const orders = new Set(pays.map((p) => p.razorpay_order_id || p.id)).size;
  const customers = new Set(pays.map((p) => (p.customer_email || p.customer_phone || p.id).toLowerCase())).size;
  const totalCost = productCost + adSpend + gatewayFees + otherExpenses;

  return {
    grossRevenue, refunds, netRevenue, productCost, grossProfit, adSpend,
    gatewayFees, otherExpenses, netProfit, sales, orders, customers, totalCost,
    aov: orders ? netRevenue / orders : 0,
    roas: adSpend ? netRevenue / adSpend : 0,
    roi: totalCost ? (netProfit / totalCost) * 100 : 0,
    cac: customers ? adSpend / customers : 0,
    costPerSale: sales ? adSpend / sales : 0,
    profitMargin: netRevenue ? (netProfit / netRevenue) * 100 : 0,
    refundRate: grossRevenue ? (refunds / grossRevenue) * 100 : 0,
  };
}

export type DailyRow = {
  date: string;
  sales: number;
  revenue: number;
  refunds: number;
  adSpend: number;
  gatewayFees: number;
  productCost: number;
  otherExpenses: number;
  grossProfit: number;
  netProfit: number;
  margin: number;
  roas: number;
  cac: number;
  aov: number;
};

export function buildDaily(args: {
  payments: SalesPayment[];
  adSpend: SalesAdSpend[];
  expenses: SalesExpense[];
  courses: SalesCourse[];
  settings: SalesSettings | null | undefined;
  filters: Filters;
}): DailyRow[] {
  const days = eachDay(args.filters.from, args.filters.to);
  return days.map((date) => {
    const m = computeMetrics({ ...args, filters: { ...args.filters, from: date, to: date } });
    return {
      date,
      sales: m.sales,
      revenue: m.netRevenue,
      refunds: m.refunds,
      adSpend: m.adSpend,
      gatewayFees: m.gatewayFees,
      productCost: m.productCost,
      otherExpenses: m.otherExpenses,
      grossProfit: m.grossProfit,
      netProfit: m.netProfit,
      margin: m.profitMargin,
      roas: m.roas,
      cac: m.cac,
      aov: m.aov,
    };
  });
}

export function groupMetricsBy<T extends string>(args: {
  payments: SalesPayment[];
  adSpend: SalesAdSpend[];
  courses: SalesCourse[];
  settings: SalesSettings | null | undefined;
  filters: Filters;
  keyOfPayment: (p: SalesPayment) => T | null;
  keyOfSpend: (a: SalesAdSpend) => T | null;
}) {
  const pays = filterPayments(args.payments, args.filters).filter((p) => SUCCESS_STATUSES.includes(p.status));
  const spends = filterAdSpend(args.adSpend, args.filters);
  const costByCourse = new Map(args.courses.map((c) => [c.id, c.unit_cost || 0]));
  const defaultCost = args.settings?.default_unit_cost ?? 0;

  const map = new Map<string, {
    key: string; sales: number; revenue: number; refunds: number; productCost: number;
    gatewayFees: number; adSpend: number;
  }>();
  const touch = (k: string) => {
    if (!map.has(k)) map.set(k, { key: k, sales: 0, revenue: 0, refunds: 0, productCost: 0, gatewayFees: 0, adSpend: 0 });
    return map.get(k)!;
  };

  pays.forEach((p) => {
    const k = args.keyOfPayment(p);
    if (!k) return;
    const row = touch(k);
    row.sales += 1;
    row.revenue += (p.final_amount || 0) - (p.refund_amount || 0);
    row.refunds += p.refund_amount || 0;
    row.productCost += p.course_id ? (costByCourse.get(p.course_id) ?? defaultCost) : defaultCost;
    row.gatewayFees += p.gateway_fee > 0 ? p.gateway_fee : gatewayFeeFor(p.final_amount || 0, args.settings);
  });
  spends.forEach((a) => {
    const k = args.keyOfSpend(a);
    if (!k) return;
    touch(k).adSpend += a.amount || 0;
  });

  return Array.from(map.values()).map((r) => {
    const grossProfit = r.revenue - r.productCost;
    const netProfit = grossProfit - r.adSpend - r.gatewayFees;
    return {
      ...r,
      grossProfit,
      netProfit,
      margin: r.revenue ? (netProfit / r.revenue) * 100 : 0,
      roas: r.adSpend ? r.revenue / r.adSpend : 0,
      cac: r.sales ? r.adSpend / r.sales : 0,
      aov: r.sales ? r.revenue / r.sales : 0,
      netProfitPerSale: r.sales ? netProfit / r.sales : 0,
      costPerSale: r.sales ? (r.productCost + r.adSpend + r.gatewayFees) / r.sales : 0,
    };
  }).sort((a, b) => b.revenue - a.revenue);
}

/** Campaign spend pacing for budget trackers. */
export function campaignPacing(c: SalesCampaign, spentSoFar: number) {
  const days = Math.max(1, c.duration_days || 1);
  const planned = c.budget_mode === "daily" ? (c.daily_budget || 0) * days : c.total_budget || 0;
  const dailyAvg = planned / days;
  const start = c.start_date ? new Date(`${c.start_date}T00:00:00`) : null;
  const elapsed = start
    ? Math.min(days, Math.max(0, Math.floor((Date.now() - start.getTime()) / 86_400_000) + 1))
    : days;
  return {
    planned,
    dailyAvg,
    elapsedDays: elapsed,
    expectedToDate: dailyAvg * elapsed,
    spent: spentSoFar,
    remaining: Math.max(0, planned - spentSoFar),
    utilized: planned ? (spentSoFar / planned) * 100 : 0,
  };
}

export function csvDownload(filename: string, rows: Record<string, string | number>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: string | number) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
