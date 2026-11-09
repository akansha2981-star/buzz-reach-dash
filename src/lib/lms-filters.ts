export type LmsFilters = {
  search: string; year: string; source: string; category: string;
  tags: string[]; tagMode: 'any' | 'all'; tagging: string;
  email: string; phone: string; sourceDetails: string;
  from: string; to: string; sort: string; direction: string;
};

export const defaultLmsFilters: LmsFilters = {
  search: '', year: 'all', source: 'all', category: 'all', tags: [],
  tagMode: 'any', tagging: 'all', email: 'all', phone: 'all',
  sourceDetails: 'all', from: '', to: '', sort: 'created_at', direction: 'desc',
};

export function buildLmsFilterQuery(f: LmsFilters) {
  const joins: string[] = [];
  const embedded: { path: string; op: 'eq' | 'in' | 'is'; value: string | null }[] = [];
  if (f.category !== 'all') {
    joins.push('category_match:lms_lead_tags!inner(lms_tags!inner(id))');
    embedded.push({ path: 'category_match.lms_tags.category_id', op: 'eq', value: f.category });
  }
  if (f.tags.length) {
    const groups = f.tagMode === 'all' ? f.tags.map(t => [t]) : [f.tags];
    groups.forEach((tags, i) => {
      const alias = `tag_match_${i}`;
      joins.push(`${alias}:lms_lead_tags!inner(tag_id)`);
      embedded.push({ path: `${alias}.tag_id`, op: 'in', value: `(${tags.join(',')})` });
    });
  }
  if (f.tagging !== 'all') {
    joins.push(`tag_presence:lms_lead_tags${f.tagging === 'tagged' ? '!inner' : ''}(id)`);
    if (f.tagging === 'untagged') embedded.push({ path: 'tag_presence', op: 'is', value: null });
  }
  const clauses: string[] = [];
  const search = f.search.trim().replace(/[(),.*%\\"]/g, ' ').trim();
  if (search) clauses.push(`or(name.ilike.*${search}*,email.ilike.*${search}*,phone.ilike.*${search}*)`);
  for (const [column, state] of [['email', f.email], ['phone', f.phone], ['source', f.sourceDetails]]) {
    if (state === 'blank') clauses.push(`or(${column}.is.null,${column}.eq."")`);
    if (state === 'filled') clauses.push(`and(${column}.not.is.null,${column}.neq."")`);
  }
  const sort = ['name', 'email', 'phone', 'source', 'year', 'created_at', 'updated_at', 'generated_at'].includes(f.sort) ? f.sort : 'created_at';
  return {
    select: ['*', ...joins].join(','), embedded,
    expression: clauses.length ? `and(${clauses.join(',')})` : '',
    sort, ascending: f.direction === 'asc',
  };
}