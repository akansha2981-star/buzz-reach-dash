import { Filter, RotateCcw, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { defaultLmsFilters, type LmsFilters } from '@/lib/lms-filters';

type Props = {
  value: LmsFilters; onChange: (value: LmsFilters) => void;
  categories: { id: string; name: string }[];
  tags: { id: string; name: string; category_id: string }[];
  sources: string[]; count: number;
};
const inputClass = 'h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring';

export function LeadFilters({ value, onChange, categories, tags, sources, count }: Props) {
  const set = (key: keyof LmsFilters, next: string | string[]) => onChange({ ...value, [key]: next });
  const visibleTags = tags.filter(t => value.category === 'all' || t.category_id === value.category);
  const active = Object.entries(value).filter(([key, v]) => JSON.stringify(v) !== JSON.stringify(defaultLmsFilters[key as keyof LmsFilters])).length;
  const select = (label: string, key: keyof LmsFilters, options: [string, string][]) => (
    <label className="min-w-0 space-y-1 text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      <select aria-label={label} className={inputClass} value={String(value[key])} onChange={e => set(key, e.target.value)}>
        {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    </label>
  );
  const blankOptions: [string, string][] = [['all', 'All entries'], ['filled', 'Hide blanks'], ['blank', 'Only blanks']];
  return (
    <section aria-label="Lead filters" className="space-y-4 border-y border-border py-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><Filter className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">Advanced filters</h2><span className="text-xs text-muted-foreground">{count.toLocaleString('en-IN')} matching leads</span></div>
        <Button variant="ghost" size="sm" onClick={() => onChange({ ...defaultLmsFilters, tags: [] })} disabled={!active}><RotateCcw />Reset filters{active > 0 ? ` (${active})` : ''}</Button>
      </div>
      <label className="relative block">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <input aria-label="Search leads" placeholder="Search name, phone or email…" className={`${inputClass} pl-9`} value={value.search} onChange={e => set('search', e.target.value)} />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {select('Source', 'source', [['all', 'All sources'], ...sources.map(s => [s, s] as [string, string])])}
        {select('Year', 'year', [['all', 'All years'], ...Array.from({ length: 10 }, (_, i) => [String(2020 + i), String(2020 + i)] as [string, string])])}
        {select('Tag category', 'category', [['all', 'All categories'], ...categories.map(c => [c.id, c.name] as [string, string])])}
        {select('Tag status', 'tagging', [['all', 'All entries'], ['tagged', 'Tagged'], ['untagged', 'Untagged']])}
        {select('Email details', 'email', blankOptions)}
        {select('Phone details', 'phone', blankOptions)}
        {select('Source details', 'sourceDetails', blankOptions)}
        {select('Sort by', 'sort', [['created_at', 'Upload date'], ['updated_at', 'Last updated'], ['name', 'Name'], ['year', 'Year'], ['source', 'Source'], ['email', 'Email'], ['phone', 'Phone']])}
        <label className="space-y-1 text-xs font-medium text-muted-foreground"><span>Uploaded from</span><input aria-label="Uploaded from" type="date" className={inputClass} value={value.from} max={value.to || undefined} onChange={e => set('from', e.target.value)} /></label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground"><span>Uploaded until</span><input aria-label="Uploaded until" type="date" className={inputClass} value={value.to} min={value.from || undefined} onChange={e => set('to', e.target.value)} /></label>
        {select('Sort direction', 'direction', [['asc', 'Ascending ↑'], ['desc', 'Descending ↓']])}
        {select('Match selected tags', 'tagMode', [['any', 'Any selected tag'], ['all', 'All selected tags']])}
      </div>
      <details className="group" open={value.tags.length > 0 || undefined}>
        <summary className="cursor-pointer text-sm font-medium text-foreground">Tags {value.tags.length ? `(${value.tags.length} selected)` : ''}</summary>
        <div className="mt-3 max-h-56 overflow-y-auto">
          {categories.filter(c => visibleTags.some(t => t.category_id === c.id)).map(c => <fieldset key={c.id} className="mb-3"><legend className="mb-2 text-xs font-semibold text-muted-foreground">{c.name}</legend><div className="flex flex-wrap gap-x-5 gap-y-2">{visibleTags.filter(t => t.category_id === c.id).map(t => <label key={t.id} className="inline-flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-primary" checked={value.tags.includes(t.id)} onChange={e => set('tags', e.target.checked ? [...value.tags, t.id] : value.tags.filter(id => id !== t.id))} />{t.name}</label>)}</div></fieldset>)}
          {!visibleTags.length && <p className="text-sm text-muted-foreground">No tags in this category.</p>}
        </div>
      </details>
      {value.tags.length > 0 && <div className="flex flex-wrap gap-2">{value.tags.map(id => <Button key={id} variant="secondary" size="sm" onClick={() => set('tags', value.tags.filter(t => t !== id))}>{tags.find(t => t.id === id)?.name ?? 'Tag'}<X /></Button>)}</div>}
    </section>
  );
}