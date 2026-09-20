import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, CalendarRange } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  RANGE_OPTIONS, resolveRange, useCourses, useWebsites, type Filters, type RangeKey,
} from "@/lib/sales";

/* ---------------- Global filter context ---------------- */

type FilterState = {
  range: RangeKey;
  from: string;
  to: string;
  websiteId: string;
  courseId: string;
  campaign: string;
  setRange: (r: RangeKey) => void;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
  setWebsiteId: (v: string) => void;
  setCourseId: (v: string) => void;
  setCampaign: (v: string) => void;
  filters: Filters;
};

const Ctx = createContext<FilterState | null>(null);

const STORE_KEY = "sales-filters-v1";

type Saved = {
  range: RangeKey; from: string; to: string;
  websiteId: string; courseId: string; campaign: string;
};

function readSaved(): Partial<Saved> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(window.localStorage.getItem(STORE_KEY) || "{}") as Partial<Saved>; }
  catch { return {}; }
}

export function SalesFilterProvider({ children }: { children: ReactNode }) {
  const [range, setRange] = useState<RangeKey>("30d");
  const [customFrom, setFrom] = useState(resolveRange("30d").from);
  const [customTo, setTo] = useState(resolveRange("30d").to);
  const [websiteId, setWebsiteId] = useState("all");
  const [courseId, setCourseId] = useState("all");
  const [campaign, setCampaign] = useState("all");
  const [hydrated, setHydrated] = useState(false);

  // Restore the last used filter selection (after hydration to avoid SSR mismatch).
  useEffect(() => {
    const s = readSaved();
    if (s.range) setRange(s.range);
    if (s.from) setFrom(s.from);
    if (s.to) setTo(s.to);
    if (s.websiteId) setWebsiteId(s.websiteId);
    if (s.courseId) setCourseId(s.courseId);
    if (s.campaign) setCampaign(s.campaign);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify({
        range, from: customFrom, to: customTo, websiteId, courseId, campaign,
      }));
    } catch { /* storage unavailable */ }
  }, [hydrated, range, customFrom, customTo, websiteId, courseId, campaign]);

  const resolved = useMemo(
    () => (range === "custom" ? { from: customFrom, to: customTo } : resolveRange(range)),
    [range, customFrom, customTo],
  );

  const value: FilterState = {
    range, from: resolved.from, to: resolved.to,
    websiteId, courseId, campaign,
    setRange, setFrom, setTo, setWebsiteId, setCourseId, setCampaign,
    filters: { from: resolved.from, to: resolved.to, websiteId, courseId, campaign },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSalesFilters() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSalesFilters must be used inside SalesFilterProvider");
  return c;
}

/* ---------------- Filter bar ---------------- */

export function SalesFilterBar({ campaigns = [] }: { campaigns?: string[] }) {
  const f = useSalesFilters();
  const { data: websites = [] } = useWebsites();
  const { data: courses = [] } = useCourses();

  return (
    <Card className="border-border/60 bg-background/95 p-3 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[150px] flex-1">
          <Label className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">Date range</Label>
          <Select value={f.range} onValueChange={(v) => f.setRange(v as RangeKey)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {f.range === "custom" && (
          <>
            <div className="min-w-[130px]">
              <Label className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">From</Label>
              <Input type="date" value={f.from} onChange={(e) => f.setFrom(e.target.value)} />
            </div>
            <div className="min-w-[130px]">
              <Label className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">To</Label>
              <Input type="date" value={f.to} onChange={(e) => f.setTo(e.target.value)} />
            </div>
          </>
        )}
        <div className="min-w-[150px] flex-1">
          <Label className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">Website</Label>
          <Select value={f.websiteId} onValueChange={f.setWebsiteId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Websites</SelectItem>
              {websites.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[150px] flex-1">
          <Label className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">Course</Label>
          <Select value={f.courseId} onValueChange={f.setCourseId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {campaigns.length > 0 && (
          <div className="min-w-[150px] flex-1">
            <Label className="mb-1 block text-[11px] uppercase tracking-wide text-muted-foreground">Campaign</Label>
            <Select value={f.campaign} onValueChange={f.setCampaign}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Campaigns</SelectItem>
                {campaigns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex items-center gap-2 pb-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2 py-1">
            <CalendarRange className="h-3.5 w-3.5" />
            <span className="tabular-nums">{f.from} → {f.to}</span>
          </span>
          <span className="hidden items-center gap-1 text-emerald-600 sm:inline-flex">
            <Check className="h-3.5 w-3.5" />Saved
          </span>
        </div>
      </div>
    </Card>
  );
}

/* ---------------- KPI card with count-up ---------------- */

function useCountUp(target: number, duration = 700) {
  const [value, setValue] = useState(target);
  useEffect(() => {
    const start = performance.now();
    const from = value;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(from + (target - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return value;
}

export function KpiCard({
  label, value, format, sub, trend, accent = "default", icon: Icon,
}: {
  label: string;
  value: number;
  format: (n: number) => string;
  sub?: string;
  trend?: number | null;
  accent?: "default" | "primary" | "success" | "warning" | "danger";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const animated = useCountUp(value);
  const accentCls = {
    default: "text-foreground",
    primary: "text-primary",
    success: "text-emerald-600",
    warning: "text-amber-600",
    danger: "text-destructive",
  }[accent];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <Card className="relative overflow-hidden border-border/60 p-4 shadow-sm transition-shadow hover:shadow-md">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          {Icon && <Icon className="h-4 w-4 text-muted-foreground/70" />}
        </div>
        <p className={cn("mt-2 font-display text-xl font-semibold tabular-nums sm:text-2xl", accentCls)}>
          {format(animated)}
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          {typeof trend === "number" && Number.isFinite(trend) && (
            <span className={cn("inline-flex items-center gap-0.5 font-medium",
              trend >= 0 ? "text-emerald-600" : "text-destructive")}>
              {trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(trend).toFixed(1)}%
            </span>
          )}
          {sub && <span className="truncate">{sub}</span>}
        </div>
      </Card>
    </motion.div>
  );
}

export function SectionCard({
  title, subtitle, action, children, className,
}: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={cn("border-border/60 shadow-sm", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div>
          <h3 className="font-display text-sm font-semibold">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </Card>
  );
}

export function LiveDot({ label = "LIVE" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-600">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
      </span>
      {label}
    </span>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="max-w-sm text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ProgressBar({ value, tone = "primary" }: { value: number; tone?: "primary" | "success" | "warning" | "danger" }) {
  const cls = {
    primary: "bg-primary", success: "bg-emerald-500", warning: "bg-amber-500", danger: "bg-destructive",
  }[tone];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <motion.div
        className={cn("h-full rounded-full", cls)}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </div>
  );
}
