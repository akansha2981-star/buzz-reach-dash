import { describe, expect, it } from 'vitest';
import { buildLmsFilterQuery, defaultLmsFilters } from './lms-filters';

describe('LMS advanced filters', () => {
  it('combines category and selected tags before pagination', () => {
    const q = buildLmsFilterQuery({ ...defaultLmsFilters, category: 'stage', tags: ['hot', 'cat'], tagMode: 'all' });
    expect(q.embedded).toEqual([
      { path: 'category_match.lms_tags.category_id', op: 'eq', value: 'stage' },
      { path: 'tag_match_0.tag_id', op: 'in', value: '(hot)' },
      { path: 'tag_match_1.tag_id', op: 'in', value: '(cat)' },
    ]);
  });
  it('matches any selected tag in any mode', () => {
    expect(buildLmsFilterQuery({ ...defaultLmsFilters, tags: ['a', 'b'] }).embedded[0].value).toBe('(a,b)');
  });
  it('keeps blank email and nonblank phone filters together', () => {
    expect(buildLmsFilterQuery({ ...defaultLmsFilters, email: 'blank', phone: 'filled' }).expression)
      .toBe('and(or(email.is.null,email.eq.""),and(phone.not.is.null,phone.neq.""))');
  });
  it('can hide blank fields without deleting records', () => {
    expect(buildLmsFilterQuery({ ...defaultLmsFilters, email: 'filled' }).expression).toBe('and(and(email.not.is.null,email.neq.""))');
  });
  it('sorts ascending or descending on the selected field', () => {
    expect(buildLmsFilterQuery({ ...defaultLmsFilters, sort: 'name', direction: 'asc' })).toMatchObject({ sort: 'name', ascending: true });
    expect(buildLmsFilterQuery({ ...defaultLmsFilters, sort: 'year', direction: 'desc' })).toMatchObject({ sort: 'year', ascending: false });
  });
  it('finds untagged leads using a database anti-join', () => {
    expect(buildLmsFilterQuery({ ...defaultLmsFilters, tagging: 'untagged' }).embedded).toEqual([{ path: 'tag_presence', op: 'is', value: null }]);
  });
});