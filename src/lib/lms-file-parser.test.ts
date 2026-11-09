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
import { parseLeadDate } from './lms-file-parser';
describe('lead generation date', () => {
  it('parses Indian DD/MM with time as IST', () => {
    expect(parseLeadDate('05/03/2026 10:30 AM')).toBe('2026-03-05T05:00:00.000Z');
  });
  it('parses named months and ISO', () => {
    expect(parseLeadDate('12 Mar 2026')).toBe('2026-03-11T18:30:00.000Z');
    expect(parseLeadDate('2026-03-12T10:00:00Z')).toBe('2026-03-12T10:00:00.000Z');
  });
  it('picks the earliest date column and detects date headers', () => {
    const r = parseGrid([
      ['Email', 'Phone', 'Enquiry Time', 'Updated On'],
      ['a@x.com', '9876543210', '10/02/2026 09:00', '01/02/2026 08:00'],
    ], 2026, 'Ninja');
    expect(r.rows[0].generated_at).toBe('2026-02-01T02:30:00.000Z');
    expect(r.rows[0].phone).toBe('9876543210');
  });
  it('combines separate date and time columns', () => {
    const r = parseGrid([['Name', 'Email', 'Created Date', 'Time'], ['Asha', 'a@x.com', '2026-04-01', '6:15 PM']], 2026, 'Ninja');
    expect(r.rows[0].generated_at).toBe('2026-04-01T12:45:00.000Z');
  });
});
