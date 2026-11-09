import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Download,
  GraduationCap,
  Pencil,
  Plus,
  Search,
  Tag as TagIcon,
  Tags,
  Trash2,
  TrendingUp,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { RequireAuth } from '@/components/RequireAuth';
import { AppShell } from '@/components/AppShell';

export const Route = createFileRoute('/lms')({
  head: () => ({
    meta: [
      { title: 'LMS Leads — MBA Compass Admin' },
      { name: 'description', content: 'Lead database with yearly tracking, tagging and analytics.' },
    ],
  }),
  component: LmsRoute,
});

const YEARS = Array.from({ length: 10 }, (_, i) => 2020 + i);
const SOURCES = ['Ninja', 'Profile Portal', 'MBA Compass', 'B School Buzz'] as const;

function SourcePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const isPreset = (SOURCES as readonly string[]).includes(value);
  const [other, setOther] = useState(!isPreset && value !== '');
  const cls = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring';
  return (
    <div className="space-y-2">
      <select
        value={other ? '__other' : value}
        onChange={(e) => {
          if (e.target.value === '__other') { setOther(true); onChange(''); }
          else { setOther(false); onChange(e.target.value); }
        }}
        className={cls}
      >
        <option value="">Select source…</option>
        {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
        <option value="__other">Others (enter manually)</option>
      </select>
      {other && <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Type source name" className={cls} />}
    </div>
  );
}
const PAGE_SIZE = 100;
const COLORS = ['#4f46e5', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];

type LeadRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  year: number;
  source: string;
  created_at: string;
};

type TagCategory = { id: string; name: string; color: string };
type Tag = { id: string; category_id: string; name: string };
type LeadTag = { lead_id: string; tag_id: string };

type Stats = {
  total: number;
  by_year: Record<string, number>;
  by_source: Record<string, number>;
  by_tag: { tag: string; category: string; color: string; count: number }[];
  by_day: { day: string; count: number }[];
  first_day: string | null;
  last_7: number;
  last_30: number;
};

type ParsedLead = { name: string; phone: string; email: string; year: number; source: string; tags: string[] };
type ImportReport = { ready: ParsedLead[]; dups: ParsedLead[]; invalid: { line: string; reason: string }[] };

function normalizePhone(p: string) {
  const d = p.replace(/\D/g, '');
  if (/^(91|0)\d{10}$/.test(d)) return d.slice(-10);
  return d;
}
function normalizeEmail(e: string) {
  return e.trim().toLowerCase();
}
function leadKey(p: string, e: string) {
  return `${normalizePhone(p)}|${normalizeEmail(e)}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseCsvText(text: string, defaultYear: number): { rows: ParsedLead[]; invalid: { line: string; reason: string }[] } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: ParsedLead[] = [];
  const invalid: { line: string; reason: string }[] = [];
  for (const raw of lines) {
    if (/^name\s*[,;\t]/i.test(raw)) continue; // header
    const parts = raw.split(/[,;\t]/).map((p) => p.trim());
    const [name = '', phone = '', email = '', source = '', tagsRaw = ''] = parts;
    if (!name && !phone && !email) continue;
    if (!name) { invalid.push({ line: raw, reason: 'Missing name' }); continue; }
    if (!phone && !email) { invalid.push({ line: raw, reason: 'Missing phone and email' }); continue; }
    if (email && !EMAIL_RE.test(email)) { invalid.push({ line: raw, reason: 'Invalid email' }); continue; }
    const tags = tagsRaw ? tagsRaw.split('|').map((t) => t.trim()).filter(Boolean) : [];
    rows.push({ name, phone, email, year: defaultYear, source, tags });
  }
  return { rows, invalid };
}

const SAMPLE_CSV = [
  'name,phone,email,source,tags',
  'Aarav Sharma,9876543210,aarav.sharma@gmail.com,Website,Stage: Hot Lead|Source Tag: Organic',
  'Priya Verma,9123456780,priya.verma@yahoo.com,Instagram Ads,Stage: Warm|Exam: CAT 2026',
  'Rohit Gupta,9988776655,rohit.gupta@outlook.com,Referral,Stage: Cold|Exam: XAT 2026',
  'Sneha Iyer,9090909090,sneha.iyer@gmail.com,Google Ads,Stage: Hot Lead|City: Delhi',
  'Karan Mehta,9812345678,karan.mehta@gmail.com,Walk-in,Stage: Enrolled|Course: CAT Full Course',
].join('\n');

function LmsRoute() {
  return (
    <RequireAuth>
      <AppShell title="LMS">
        <LmsPage />
      </AppShell>
    </RequireAuth>
  );
}

function LmsPage() {
  const { isAdmin, perms, loading: authLoading } = useAuth();
  const allowed = isAdmin || perms.can_lms;
  const loaded = !authLoading;

  const [stats, setStats] = useState<Stats | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [categories, setCategories] = useState<TagCategory[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [leadTags, setLeadTags] = useState<LeadTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [leadsLoading, setLeadsLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [yearFilter, setYearFilter] = useState<'all' | number>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');

  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [bulkTagOpen, setBulkTagOpen] = useState(false);
  const [assignFor, setAssignFor] = useState<LeadRow | null>(null);
  const [editing, setEditing] = useState<LeadRow | null>(null);

  async function loadStats() {
    const { data, error } = await supabase.rpc('lms_stats');
    if (!error && data) setStats(data as unknown as Stats);
  }

  async function loadTaxonomy() {
    const [{ data: cats }, { data: tgs }] = await Promise.all([
      supabase.from('lms_tag_categories').select('*').order('name'),
      supabase.from('lms_tags').select('*').order('name'),
    ]);
    setCategories((cats as TagCategory[]) ?? []);
    setTags((tgs as Tag[]) ?? []);
  }

  async function loadLeads() {
    setLeadsLoading(true);
    let q = supabase
      .from('lms_leads')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (yearFilter !== 'all') q = q.eq('year', yearFilter);
    if (search) q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    if (tagFilter !== 'all') {
      const { data: lt } = await supabase.from('lms_lead_tags').select('lead_id').eq('tag_id', tagFilter);
      const ids = (lt ?? []).map((r) => r.lead_id);
      if (ids.length === 0) {
        setLeads([]); setTotalCount(0); setLeadsLoading(false); return;
      }
      q = q.in('id', ids);
    }
    const { data, count, error } = await q;
    if (error) toast.error(error.message);
    const rows = (data as LeadRow[]) ?? [];
    setLeads(rows);
    setTotalCount(count ?? 0);
    if (rows.length) {
      const { data: lt } = await supabase
        .from('lms_lead_tags')
        .select('lead_id, tag_id')
        .in('lead_id', rows.map((r) => r.id));
      setLeadTags((lt as LeadTag[]) ?? []);
    } else {
      setLeadTags([]);
    }
    setLeadsLoading(false);
  }

  useEffect(() => {
    if (!allowed) return;
    (async () => {
      setLoading(true);
      await Promise.all([loadStats(), loadTaxonomy()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  useEffect(() => {
    if (!allowed || loading) return;
    loadLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, loading, page, yearFilter, search, tagFilter]);

  async function refreshAll() {
    await Promise.all([loadStats(), loadLeads()]);
  }

  // ---------- derived dashboard data ----------
  const cumulative = useMemo(() => {
    if (!stats) return [];
    const days = [...stats.by_day].sort((a, b) => a.day.localeCompare(b.day));
    let run = (stats.total - days.reduce((s, d) => s + d.count, 0));
    return days.map((d) => {
      run += d.count;
      return { day: d.day.slice(5), added: d.count, total: run };
    });
  }, [stats]);

  const averages = useMemo(() => {
    if (!stats || stats.total === 0) return { daily: 0, weekly: 0, monthly: 0 };
    const first = stats.first_day ? new Date(stats.first_day).getTime() : Date.now();
    const days = Math.max(1, Math.ceil((Date.now() - first) / 86400000));
    const daily = stats.total / days;
    return {
      daily: Math.round(daily * 10) / 10,
      weekly: Math.round(daily * 7 * 10) / 10,
      monthly: Math.round(daily * 30.4 * 10) / 10,
    };
  }, [stats]);

  const sourceRows = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.by_source)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [stats]);

  const yearRows = useMemo(() => {
    if (!stats) return [];
    return YEARS.map((y) => ({ year: String(y), count: stats.by_year[String(y)] ?? 0 })).filter((r) => r.count > 0);
  }, [stats]);

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const leadTagMap = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const lt of leadTags) {
      const arr = m.get(lt.lead_id) ?? [];
      arr.push(lt.tag_id);
      m.set(lt.lead_id, arr);
    }
    return m;
  }, [leadTags]);

  if (!loaded) return null;
  if (!allowed) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <GraduationCap className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-3 text-lg font-semibold">No access</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ask the master admin to enable LMS access for your account.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-3 py-6 sm:px-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">LMS Leads</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Daily lead data with yearly cohorts, tagging and analytics
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTagsOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-muted sm:text-sm"
          >
            <Tags className="h-4 w-4" /> Tags
          </button>
          <button
            onClick={() => setBulkTagOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-muted sm:text-sm"
          >
            <TagIcon className="h-4 w-4" /> Bulk Tag
          </button>
          <button
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold hover:bg-muted sm:text-sm"
          >
            <Upload className="h-4 w-4" /> Import
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 sm:text-sm"
          >
            <Plus className="h-4 w-4" /> Add Lead
          </button>
        </div>
      </div>

      {/* Dashboard */}
      {stats && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard icon={<Users className="h-4 w-4" />} label="Total Leads" value={stats.total.toLocaleString('en-IN')} sub={`+${stats.last_7.toLocaleString('en-IN')} last 7 days`} />
            <KpiCard icon={<TrendingUp className="h-4 w-4" />} label="Daily Average" value={String(averages.daily)} sub="leads per day" />
            <KpiCard icon={<BarChart3 className="h-4 w-4" />} label="Weekly Average" value={averages.weekly.toLocaleString('en-IN')} sub={`+${stats.last_30.toLocaleString('en-IN')} last 30 days`} />
            <KpiCard icon={<BarChart3 className="h-4 w-4" />} label="Monthly Average" value={averages.monthly.toLocaleString('en-IN')} sub="leads per month" />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* Cumulative chart */}
            <div className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Cumulative Lead Growth</h3>
                <span className="text-[10px] text-muted-foreground">last 180 days</span>
              </div>
              {cumulative.length ? (
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={cumulative} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
                      <defs>
                        <linearGradient id="lmsCum" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickLine={false} />
                      <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid hsl(var(--border))' }}
                        formatter={(v: number, name: string) => [v.toLocaleString('en-IN'), name === 'total' ? 'Total leads' : 'Added']}
                      />
                      <Area type="monotone" dataKey="total" stroke="#4f46e5" strokeWidth={2} fill="url(#lmsCum)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="py-10 text-center text-xs text-muted-foreground">No lead activity yet.</p>
              )}
            </div>

            {/* Source-wise */}
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">Source-wise Leads</h3>
              {sourceRows.length ? (
                <div className="space-y-2">
                  {sourceRows.map((s, i) => (
                    <div key={s.name}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="truncate font-medium">{s.name}</span>
                        <span className="text-muted-foreground">{s.count.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.max(3, (s.count / Math.max(1, stats.total)) * 100)}%`, background: COLORS[i % COLORS.length] }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-xs text-muted-foreground">No sources recorded yet.</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Year-wise */}
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-2 text-sm font-semibold">Year-wise Distribution</h3>
              {yearRows.length ? (
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={yearRows} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="year" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickLine={false} />
                      <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid hsl(var(--border))' }} formatter={(v: number) => [v.toLocaleString('en-IN'), 'Leads']} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {yearRows.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="py-8 text-center text-xs text-muted-foreground">No data yet.</p>
              )}
            </div>

            {/* Tag-wise */}
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">Tag-wise Leads</h3>
              {stats.by_tag.length ? (
                <div className="flex flex-wrap gap-2">
                  {stats.by_tag.slice(0, 24).map((t) => (
                    <span
                      key={`${t.category}-${t.tag}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-medium"
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
                      {t.category}: {t.tag}
                      <span className="text-muted-foreground">({t.count.toLocaleString('en-IN')})</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-xs text-muted-foreground">No tags assigned yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(0);
            setSearch(searchInput.trim());
          }}
        >
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, phone or email…"
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </form>
        <select
          value={yearFilter === 'all' ? 'all' : String(yearFilter)}
          onChange={(e) => { setPage(0); setYearFilter(e.target.value === 'all' ? 'all' : Number(e.target.value)); }}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All years</option>
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select
          value={tagFilter}
          onChange={(e) => { setPage(0); setTagFilter(e.target.value); }}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All tags</option>
          {categories.map((c) => (
            <optgroup key={c.id} label={c.name}>
              {tags.filter((t) => t.category_id === c.id).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Phone</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Source</th>
                <th className="px-4 py-2.5 font-medium">Year</th>
                <th className="px-4 py-2.5 font-medium">Tags</th>
                <th className="px-4 py-2.5 font-medium">Added</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{l.name}</td>
                  <td className="px-4 py-2.5">{l.phone}</td>
                  <td className="max-w-[180px] truncate px-4 py-2.5">{l.email || '—'}</td>
                  <td className="px-4 py-2.5 text-xs">{l.source || '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">{l.year}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex max-w-[220px] flex-wrap gap-1">
                      {(leadTagMap.get(l.id) ?? []).slice(0, 3).map((tid) => {
                        const t = tagsById.get(tid);
                        const c = t ? catById.get(t.category_id) : undefined;
                        if (!t) return null;
                        return (
                          <span key={tid} className="inline-flex items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: c?.color ?? '#94a3b8' }} />
                            {t.name}
                          </span>
                        );
                      })}
                      {(leadTagMap.get(l.id) ?? []).length > 3 && (
                        <span className="text-[10px] text-muted-foreground">+{(leadTagMap.get(l.id) ?? []).length - 3}</span>
                      )}
                      <button
                        onClick={() => setAssignFor(l)}
                        className="rounded-full border border-dashed border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:border-indigo-400 hover:text-indigo-600"
                      >
                        + tag
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{new Date(l.created_at).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setEditing(l)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Edit">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete lead "${l.name}"?`)) return;
                          const { error } = await supabase.from('lms_leads').delete().eq('id', l.id);
                          if (error) { toast.error(error.message); return; }
                          toast.success('Lead deleted');
                          refreshAll();
                        }}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!leadsLoading && leads.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No leads found. Add one or import a CSV.
                  </td>
                </tr>
              )}
              {leadsLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">Loading…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          <span>
            {totalCount.toLocaleString('en-IN')} leads · page {page + 1} of {pageCount}
          </span>
          <div className="flex gap-1">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-lg border border-border p-1.5 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-border p-1.5 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {addOpen && (
        <LeadForm
          onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); refreshAll(); }}
        />
      )}
      {editing && (
        <LeadForm
          lead={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refreshAll(); }}
        />
      )}
      {importOpen && (
        <ImportDialog
          categories={categories}
          tags={tags}
          onClose={() => setImportOpen(false)}
          onDone={() => { setImportOpen(false); refreshAll(); }}
        />
      )}
      {tagsOpen && (
        <TagManager
          categories={categories}
          tags={tags}
          onClose={() => setTagsOpen(false)}
          onChanged={() => { loadTaxonomy(); loadStats(); }}
        />
      )}
      {assignFor && (
        <AssignTags
          lead={assignFor}
          categories={categories}
          tags={tags}
          assigned={leadTagMap.get(assignFor.id) ?? []}
          onClose={() => setAssignFor(null)}
          onSaved={() => { setAssignFor(null); loadLeads(); loadStats(); }}
        />
      )}
      {bulkTagOpen && (
        <BulkTagDialog
          categories={categories}
          tags={tags}
          onClose={() => setBulkTagOpen(false)}
          onDone={() => { setBulkTagOpen(false); loadTaxonomy(); loadLeads(); loadStats(); }}
        />
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-xl font-bold tracking-tight sm:text-2xl">{value}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function LeadForm({ lead, onClose, onSaved }: { lead?: LeadRow; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(lead?.name ?? '');
  const [phone, setPhone] = useState(lead?.phone ?? '');
  const [email, setEmail] = useState(lead?.email ?? '');
  const [source, setSource] = useState(lead?.source ?? '');
  const [year, setYear] = useState(lead?.year ?? new Date().getFullYear());
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim() || (!phone.trim() && !email.trim())) { toast.error('Name and phone or email are required'); return; }
    if (email && !EMAIL_RE.test(email)) { toast.error('Invalid email'); return; }
    setSaving(true);
    const payload = { name: name.trim(), phone: phone.trim(), email: email.trim(), source: source.trim(), year };
    const { error } = lead
      ? await supabase.from('lms_leads').update(payload).eq('id', lead.id)
      : await supabase.from('lms_leads').insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(lead ? 'Lead updated' : 'Lead added');
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl border border-border bg-card p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{lead ? 'Edit Lead' : 'Add Lead'}</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <Field label="Name *">
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </Field>
          <Field label="Phone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </Field>
          <Field label="Email">
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </Field>
          <Field label="Source">
            <SourcePicker value={source} onChange={setSource} />
          </Field>
          <Field label="Year">
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </Field>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="mt-5 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Saving…' : lead ? 'Save changes' : 'Add lead'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ImportDialog({
  categories,
  tags,
  onClose,
  onDone,
}: {
  categories: TagCategory[];
  tags: Tag[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [source, setSource] = useState('');
  const [report, setReport] = useState<ImportReport | null>(null);
  const [fileName, setFileName] = useState('');
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(f: File) {
    if (!source.trim()) { toast.error('Select a source first'); return; }
    setFileName(f.name);
    setChecking(true);
    const text = await f.text();
    const { rows, invalid } = parseCsvText(text, year);

    // In-batch duplicates (same phone+email twice in file)
    const seen = new Set<string>();
    const batchDups: ParsedLead[] = [];
    const unique: ParsedLead[] = [];
    for (const r of rows) {
      const k = leadKey(r.phone, r.email);
      if (seen.has(k)) batchDups.push(r);
      else { seen.add(k); unique.push(r); }
    }

    const ready = unique;
    const dbDups: ParsedLead[] = [];
    setReport({ ready, dups: [...batchDups, ...dbDups], invalid });
    setChecking(false);
  }

  async function doImport() {
    if (!report || report.ready.length === 0) return;
    setImporting(true);
    if (!source.trim()) { toast.error('Select a source first'); setImporting(false); return; }
    let inserted = 0, updated = 0, merged = 0;
    for (let i = 0; i < report.ready.length; i += 200) {
      const chunk = report.ready.slice(i, i + 200);
      const { data: res, error } = await supabase.rpc('lms_upsert_leads', {
        rows: chunk.map((r) => ({ name: r.name, phone: r.phone, email: r.email, source: source.trim(), year })),
      });
      if (error) { toast.error(error.message); setImporting(false); return; }
      const out = res as { inserted: number; updated: number; merged: number; rows: { i: number; id: string }[] };
      inserted += out.inserted; updated += out.updated; merged += out.merged;
      const idByIdx = new Map(out.rows.map((x) => [x.i, x.id]));

      // Attach tags from the tags column (Category: Tag|Category: Tag)
      const tagInserts: { lead_id: string; tag_id: string }[] = [];
      for (const [ri, r] of chunk.entries()) {
        if (!r.tags.length) continue;
        const leadId = idByIdx.get(ri);
        if (!leadId) continue;
        for (const spec of r.tags) {
          const [catName, tagName] = spec.split(':').map((s) => s.trim());
          if (!catName || !tagName) continue;
          const cat = categories.find((c) => c.name.toLowerCase() === catName.toLowerCase());
          const tag = cat && tags.find((t) => t.category_id === cat.id && t.name.toLowerCase() === tagName.toLowerCase());
          if (tag) tagInserts.push({ lead_id: leadId, tag_id: tag.id });
        }
      }
      if (tagInserts.length) {
        await supabase.from('lms_lead_tags').upsert(tagInserts, { onConflict: 'lead_id,tag_id', ignoreDuplicates: true });
      }
    }
    setImporting(false);
    toast.success(`${inserted.toLocaleString('en-IN')} new · ${updated.toLocaleString('en-IN')} updated (year & source) · ${merged.toLocaleString('en-IN')} merged (missing details filled)`);
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-border bg-card p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Import Leads (CSV)</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900">
          <p className="font-semibold">Format: name, phone, email, source, tags</p>
          <p className="mt-1">
            Tags are optional: <code>Category: Tag|Category: Tag</code>. Leads already in the system are <strong>updated</strong> with the latest year &amp; source (no new lead). If an earlier
            lead was missing its phone or email and this file has it, the detail is filled into the earlier lead. Same number with a
            different email (or vice versa) is still added as a new lead.
          </p>
          <button
            onClick={() => {
              const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'lms-leads-sample.csv';
              a.click();
            }}
            className="mt-2 inline-flex items-center gap-1 rounded-md border border-indigo-300 bg-white px-2 py-1 font-semibold hover:bg-indigo-100"
          >
            <Download className="h-3.5 w-3.5" /> Download sample file (with sample categories & tags)
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Field label="Source for this batch *">
            <div className="min-w-[200px]"><SourcePicker value={source} onChange={setSource} /></div>
          </Field>
          <Field label="Year for this batch">
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring">
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </Field>
          <button
            onClick={() => fileRef.current?.click()}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold hover:bg-muted"
          >
            <Upload className="h-4 w-4" /> {fileName || 'Choose CSV / TXT'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = '';
            }}
          />
        </div>

        {checking && <p className="py-6 text-center text-sm text-muted-foreground">Checking duplicates…</p>}

        {report && !checking && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                <div className="text-lg font-bold text-emerald-700">{report.ready.length}</div>
                <div className="text-[11px] text-emerald-700">Rows to process</div>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="text-lg font-bold text-amber-700">{report.dups.length}</div>
                <div className="text-[11px] text-amber-700">Repeated in file</div>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <div className="text-lg font-bold text-red-700">{report.invalid.length}</div>
                <div className="text-[11px] text-red-700">Invalid rows</div>
              </div>
            </div>

            {report.dups.length > 0 && (
              <details className="rounded-lg border border-border">
                <summary className="cursor-pointer px-3 py-2 text-xs font-semibold">View duplicates ({report.dups.length})</summary>
                <div className="max-h-40 overflow-y-auto border-t border-border px-3 py-2 text-xs">
                  {report.dups.slice(0, 100).map((d, i) => (
                    <div key={i} className="flex justify-between gap-2 py-0.5">
                      <span className="truncate">{d.name} — {d.phone}</span>
                      <span className="truncate text-muted-foreground">{d.email}</span>
                    </div>
                  ))}
                  {report.dups.length > 100 && <p className="py-1 text-muted-foreground">…and {report.dups.length - 100} more</p>}
                </div>
              </details>
            )}
            {report.invalid.length > 0 && (
              <details className="rounded-lg border border-border">
                <summary className="cursor-pointer px-3 py-2 text-xs font-semibold">View invalid rows ({report.invalid.length})</summary>
                <div className="max-h-40 overflow-y-auto border-t border-border px-3 py-2 text-xs">
                  {report.invalid.slice(0, 100).map((d, i) => (
                    <div key={i} className="flex justify-between gap-2 py-0.5">
                      <span className="truncate">{d.line}</span>
                      <span className="text-red-600">{d.reason}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            <button
              onClick={doImport}
              disabled={importing || report.ready.length === 0}
              className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {importing ? 'Importing…' : `Import ${report.ready.length.toLocaleString('en-IN')} rows`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TagManager({
  categories,
  tags,
  onClose,
  onChanged,
}: {
  categories: TagCategory[];
  tags: Tag[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [newCat, setNewCat] = useState('');
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [newTagFor, setNewTagFor] = useState<string | null>(null);
  const [newTag, setNewTag] = useState('');

  async function addCategory() {
    if (!newCat.trim()) return;
    const { error } = await supabase.from('lms_tag_categories').insert({ name: newCat.trim(), color: newColor });
    if (error) { toast.error(error.message); return; }
    setNewCat('');
    onChanged();
  }

  async function addTag(categoryId: string) {
    if (!newTag.trim()) return;
    const { error } = await supabase.from('lms_tags').insert({ category_id: categoryId, name: newTag.trim() });
    if (error) { toast.error(error.message); return; }
    setNewTag('');
    setNewTagFor(null);
    onChanged();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-card p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Tag Categories & Tags</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="mb-4 flex gap-2">
          <input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            placeholder="New category (e.g. Stage, Exam, City)"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex items-center gap-1">
            {COLORS.slice(0, 5).map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={cn('h-6 w-6 rounded-full border-2', newColor === c ? 'border-foreground' : 'border-transparent')}
                style={{ background: c }}
              />
            ))}
          </div>
          <button onClick={addCategory} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Add</button>
        </div>

        <div className="space-y-3">
          {categories.map((c) => (
            <div key={c.id} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-sm font-semibold">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                  {c.name}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => { setNewTagFor(newTagFor === c.id ? null : c.id); setNewTag(''); }}
                    className="rounded-md border border-border px-2 py-1 text-[11px] font-semibold hover:bg-muted"
                  >
                    + Tag
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Delete category "${c.name}" and all its tags?`)) return;
                      const { error } = await supabase.from('lms_tag_categories').delete().eq('id', c.id);
                      if (error) { toast.error(error.message); return; }
                      onChanged();
                    }}
                    className="rounded-md p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tags.filter((t) => t.category_id === c.id).map((t) => (
                  <span key={t.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px]">
                    {t.name}
                    <button
                      onClick={async () => {
                        const { error } = await supabase.from('lms_tags').delete().eq('id', t.id);
                        if (error) { toast.error(error.message); return; }
                        onChanged();
                      }}
                      className="text-muted-foreground hover:text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {tags.filter((t) => t.category_id === c.id).length === 0 && (
                  <span className="text-[11px] text-muted-foreground">No tags yet</span>
                )}
              </div>
              {newTagFor === c.id && (
                <div className="mt-2 flex gap-2">
                  <input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Tag name"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && addTag(c.id)}
                    className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button onClick={() => addTag(c.id)} className="rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground">Add</button>
                </div>
              )}
            </div>
          ))}
          {categories.length === 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">No categories yet. Create one above, e.g. "Stage", "Exam", "City".</p>
          )}
        </div>
      </div>
    </div>
  );
}

function AssignTags({
  lead,
  categories,
  tags,
  assigned,
  onClose,
  onSaved,
}: {
  lead: LeadRow;
  categories: TagCategory[];
  tags: Tag[];
  assigned: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(assigned));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const toAdd = [...selected].filter((id) => !assigned.includes(id));
    const toRemove = assigned.filter((id) => !selected.has(id));
    if (toAdd.length) {
      const { error } = await supabase.from('lms_lead_tags').upsert(toAdd.map((tag_id) => ({ lead_id: lead.id, tag_id })), { onConflict: 'lead_id,tag_id', ignoreDuplicates: true });
      if (error) { toast.error(error.message); setSaving(false); return; }
    }
    if (toRemove.length) {
      const { error } = await supabase.from('lms_lead_tags').delete().eq('lead_id', lead.id).in('tag_id', toRemove);
      if (error) { toast.error(error.message); setSaving(false); return; }
    }
    setSaving(false);
    toast.success('Tags updated');
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-border bg-card p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-base font-semibold">Tags for {lead.name}</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">Select as many tags as you want.</p>
        <div className="space-y-3">
          {categories.map((c) => (
            <div key={c.id}>
              <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold">
                <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                {c.name}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tags.filter((t) => t.category_id === c.id).map((t) => {
                  const on = selected.has(t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        const next = new Set(selected);
                        if (on) next.delete(t.id); else next.add(t.id);
                        setSelected(next);
                      }}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                        on ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-border text-muted-foreground hover:border-indigo-300',
                      )}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {categories.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">Create categories and tags first.</p>}
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="mt-5 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save tags'}
        </button>
      </div>
    </div>
  );
}

function BulkTagDialog({
  categories,
  tags,
  onClose,
  onDone,
}: {
  categories: TagCategory[];
  tags: Tag[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [emails, setEmails] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [catId, setCatId] = useState('');
  const [tagId, setTagId] = useState('');
  const [newCat, setNewCat] = useState('');
  const [newTag, setNewTag] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ matched: number; tagged: number; missing: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const catTags = tags.filter((t) => t.category_id === catId);

  async function handleFile(f: File) {
    setFileName(f.name);
    const text = await f.text();
    const found = text
      .split(/[\r\n,;\t ]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => EMAIL_RE.test(s));
    setEmails([...new Set(found)]);
    setResult(null);
  }

  async function ensureTag(): Promise<string | null> {
    let cId = catId;
    if (!cId && newCat.trim()) {
      const { data, error } = await supabase.from('lms_tag_categories').insert({ name: newCat.trim(), color: COLORS[categories.length % COLORS.length] }).select('id').single();
      if (error) { toast.error(error.message); return null; }
      cId = data.id;
    }
    if (!cId) { toast.error('Pick or create a category'); return null; }
    let tId = tagId;
    if (!tId && newTag.trim()) {
      const { data, error } = await supabase.from('lms_tags').insert({ category_id: cId, name: newTag.trim() }).select('id').single();
      if (error) { toast.error(error.message); return null; }
      tId = data.id;
    }
    if (!tId) { toast.error('Pick or create a tag'); return null; }
    return tId;
  }

  async function run() {
    if (emails.length === 0) { toast.error('Upload an email list first'); return; }
    setRunning(true);
    const tId = await ensureTag();
    if (!tId) { setRunning(false); return; }

    let matched = 0;
    let tagged = 0;
    for (let i = 0; i < emails.length; i += 300) {
      const chunk = emails.slice(i, i + 300);
      const { data: leads, error } = await supabase.from('lms_leads').select('id').in('email', chunk);
      if (error) { toast.error(error.message); setRunning(false); return; }
      const ids = (leads ?? []).map((l) => l.id);
      matched += ids.length;
      if (ids.length) {
        const { error: upErr } = await supabase
          .from('lms_lead_tags')
          .upsert(ids.map((lead_id) => ({ lead_id, tag_id: tId })), { onConflict: 'lead_id,tag_id', ignoreDuplicates: true });
        if (upErr) { toast.error(upErr.message); setRunning(false); return; }
        tagged += ids.length;
      }
    }
    setResult({ matched, tagged, missing: emails.length - matched });
    setRunning(false);
    toast.success(`Tagged ${tagged.toLocaleString('en-IN')} leads`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-card p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Bulk Tag by Email List</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900">
          Upload a CSV/TXT of emails (one per line or comma-separated). Every existing lead with a matching email gets the selected tag.
        </div>

        <div className="space-y-3">
          <button
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold hover:bg-muted"
          >
            <Upload className="h-4 w-4" /> {fileName || 'Choose email list'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = '';
            }}
          />
          {emails.length > 0 && <p className="text-xs text-muted-foreground">{emails.length.toLocaleString('en-IN')} unique emails found</p>}

          <Field label="Tag category">
            <select
              value={catId}
              onChange={(e) => { setCatId(e.target.value); setTagId(''); }}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">— select or create below —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          {!catId && (
            <Field label="Or new category">
              <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="e.g. Campaign 2026" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </Field>
          )}
          {(catId || newCat.trim()) && (
            <Field label="Tag">
              <select
                value={tagId}
                onChange={(e) => setTagId(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— select or create below —</option>
                {catTags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
          )}
          {(catId || newCat.trim()) && !tagId && (
            <Field label="Or new tag">
              <input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="e.g. Diwali Offer" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </Field>
          )}

          {result && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
                <div className="text-base font-bold text-emerald-700">{result.tagged}</div>
                <div className="text-[10px] text-emerald-700">Tagged</div>
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-2.5">
                <div className="text-base font-bold">{result.matched}</div>
                <div className="text-[10px] text-muted-foreground">Matched</div>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                <div className="text-base font-bold text-amber-700">{result.missing}</div>
                <div className="text-[10px] text-amber-700">Not in database</div>
              </div>
            </div>
          )}

          <button
            onClick={run}
            disabled={running || emails.length === 0}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {running ? 'Applying tags…' : 'Apply tag to matching leads'}
          </button>
          {result && (
            <button onClick={onDone} className="w-full rounded-lg border border-border py-2 text-sm font-semibold hover:bg-muted">
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
