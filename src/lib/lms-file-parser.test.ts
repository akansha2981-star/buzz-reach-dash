import { describe, it, expect } from 'vitest';
import { parseGrid, parseFreeText } from './lms-file-parser';
describe('smart lead parser', () => {
  it('detects shuffled columns, per-row source and year', () => {
    const r = parseGrid([
      ['Mail', 'Student', 'Mob', 'From', 'Batch'],
      ['a@x.com', 'Asha Rao', '9876543210', 'MBA Compass', '2027'],
      ['b@x.com', 'Ravi K', '+91 98765 43211', 'ninja', '2025'],
    ], 2026, '');
    expect(r.rows[0]).toMatchObject({ email: 'a@x.com', name: 'Asha Rao', phone: '9876543210', source: 'MBA Compass', year: 2027 });
    expect(r.rows[1]).toMatchObject({ source: 'Ninja', year: 2025 });
  });
  it('fixes mislabeled phone/email columns by content', () => {
    const r = parseGrid([['name', 'email', 'phone'], ['Dhananjay', '9999988888', 'd@g.com']], 2026, 'Others');
    expect(r.rows[0]).toMatchObject({ email: 'd@g.com', phone: '9999988888', source: 'Others' });
  });
  it('extracts from free text', () => {
    const r = parseFreeText('Contact Neha Singh 9812345678 neha@ex.com B School Buzz', 2026, '');
    expect(r.rows[0]).toMatchObject({ email: 'neha@ex.com', phone: '9812345678', source: 'B School Buzz' });
  });
});
