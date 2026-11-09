// Smart lead-file reader: turns any spreadsheet / text file into a grid, then
// auto-detects which column holds name / phone / email / source / year / tags
// using both header names and the actual cell contents.

export type LeadField = 'name' | 'phone' | 'email' | 'source' | 'year' | 'tags';
export type SmartLead = { name: string; phone: string; email: string; year: number; source: string; tags: string[] };
export type SmartResult = {
  rows: SmartLead[];
  invalid: { line: string; reason: string }[];
  mapping: { column: string; field: LeadField | null }[];
  mode: 'table' | 'text';
};

export const KNOWN_SOURCES = ['Ninja', 'Profile Portal', 'MBA Compass', 'B School Buzz'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_FIND = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_FIND = /(?:\+?\d[\d\s().-]{6,}\d)/g;

const digits = (v: string) => v.replace(/\D/g, '');
const isPhone = (v: string) => { const d = digits(v); return d.length >= 7 && d.length <= 15 && !/[a-z@]/i.test(v); };
const isYear = (v: string) => /^20(2\d)$/.test(v.trim());
const isNameLike = (v: string) => /^[A-Za-z][A-Za-z .'-]{1,60}$/.test(v.trim());

export function matchSource(v: string): string | null {
  const s = v.toLowerCase().replace(/[^a-z]/g, '');
  if (!s) return null;
  for (const k of KNOWN_SOURCES) if (s.includes(k.toLowerCase().replace(/[^a-z]/g, ''))) return k;
  return null;
}

function headerField(h: string): LeadField | null {
  const s = h.trim().toLowerCase();
  if (!s) return null;
  if (/e-?mail|mail id/.test(s)) return 'email';
  if (/phone|mobile|number|contact|whatsapp|cell/.test(s)) return 'phone';
  if (/source|platform|channel|portal|website/.test(s)) return 'source';
  if (/year|batch/.test(s)) return 'year';
  if (/tag|label/.test(s)) return 'tags';
  if (/name|student|candidate|full/.test(s)) return 'name';
  return null;
}

function detectByContent(grid: string[][], start: number): (LeadField | null)[] {
  const width = Math.max(0, ...grid.map((r) => r.length));
  const sample = grid.slice(start, start + 200);
  const scores: Record<LeadField, number>[] = [];
  for (let c = 0; c < width; c++) {
    const vals = sample.map((r) => (r[c] ?? '').trim()).filter(Boolean);
    const n = vals.length || 1;
    scores.push({
      email: vals.filter((v) => EMAIL_RE.test(v)).length / n,
      phone: vals.filter(isPhone).length / n,
      year: vals.filter(isYear).length / n,
      source: vals.filter((v) => matchSource(v)).length / n,
      name: vals.filter(isNameLike).length / n,
      tags: vals.filter((v) => /:/.test(v) && !/@/.test(v)).length / n,
    });
  }
  const result: (LeadField | null)[] = new Array(width).fill(null);
  const order: LeadField[] = ['email', 'phone', 'year', 'source', 'tags', 'name'];
  for (const f of order) {
    let best = -1, bestScore = 0.5;
    scores.forEach((s, c) => { if (result[c] === null && s[f] > bestScore) { best = c; bestScore = s[f]; } });
    if (best >= 0) result[best] = f;
  }
  return result;
}

/** Parse a grid (rows of cells) into leads. */
export function parseGrid(gridIn: unknown[][], defaultYear: number, defaultSource: string): SmartResult {
  const grid = gridIn
    .map((r) => r.map((c) => (c == null ? '' : String(c).trim())))
    .filter((r) => r.some(Boolean));
  const invalid: SmartResult['invalid'] = [];
  const rows: SmartLead[] = [];
  if (!grid.length) return { rows, invalid, mapping: [], mode: 'table' };

  // Find header row within first 10 rows
  let headerIdx = -1;
  for (let i = 0; i < Math.min(10, grid.length); i++) {
    const m = grid[i].map(headerField);
    if (m.filter(Boolean).length >= 2 && !grid[i].some((c) => EMAIL_RE.test(c))) { headerIdx = i; break; }
  }
  const start = headerIdx + 1;
  const content = detectByContent(grid, start);
  let map: (LeadField | null)[] = content;
  if (headerIdx >= 0) {
    const fromHeader = grid[headerIdx].map(headerField);
    map = content.map((c, i) => c ?? fromHeader[i] ?? null);
    // Content wins for email/phone (fixes mislabeled columns); header fills the rest
    fromHeader.forEach((f, i) => { if (f && !map.includes(f) && map[i] === null) map[i] = f; });
  }
  // Ensure single column per field
  const used = new Set<LeadField>();
  map = map.map((f) => (f && !used.has(f) ? (used.add(f), f) : null));

  const mapping = map.map((field, i) => ({ column: headerIdx >= 0 ? grid[headerIdx][i] || `Column ${i + 1}` : `Column ${i + 1}`, field }));

  for (let r = start; r < grid.length; r++) {
    const row = grid[r];
    let name = '', phone = '', email = '', source = '', yearRaw = '', tagsRaw = '';
    map.forEach((f, i) => {
      const v = row[i] ?? '';
      if (f === 'name') name = v; else if (f === 'phone') phone = v; else if (f === 'email') email = v;
      else if (f === 'source') source = v; else if (f === 'year') yearRaw = v; else if (f === 'tags') tagsRaw = v;
    });
    // Rescue: find email/phone anywhere in the row if column was blank
    const joined = row.join(' ');
    if (!email) email = joined.match(EMAIL_FIND)?.[0] ?? '';
    if (!phone) phone = row.find((c) => isPhone(c) && !isYear(c)) ?? '';
    if (!source) source = row.map(matchSource).find(Boolean) ?? '';
    const y = Number(yearRaw.match(/20(2\d)/)?.[0]);
    if (!name) name = row.find((c) => isNameLike(c) && !matchSource(c)) ?? (email ? email.split('@')[0] : '');
    if (!phone && !email) { invalid.push({ line: row.join(', '), reason: 'No phone or email found' }); continue; }
    if (email && !EMAIL_RE.test(email)) { invalid.push({ line: row.join(', '), reason: 'Invalid email' }); continue; }
    rows.push({
      name: name || 'Unknown',
      phone,
      email: email.toLowerCase(),
      year: y >= 2020 && y <= 2029 ? y : defaultYear,
      source: matchSource(source) ?? (source || defaultSource),
      tags: tagsRaw ? tagsRaw.split(/[|]/).map((t) => t.trim()).filter(Boolean) : [],
    });
  }
  return { rows, invalid, mapping, mode: 'table' };
}

/** Unstructured text (PDF text, Word, notes, vCard…): pull out each line's email/phone. */
export function parseFreeText(text: string, defaultYear: number, defaultSource: string): SmartResult {
  const rows: SmartLead[] = [];
  const invalid: SmartResult['invalid'] = [];
  // vCard support
  if (/BEGIN:VCARD/i.test(text)) {
    for (const card of text.split(/END:VCARD/i)) {
      const name = card.match(/^FN[^:]*:(.*)$/im)?.[1]?.trim() ?? '';
      const phone = card.match(/^TEL[^:]*:(.*)$/im)?.[1]?.trim() ?? '';
      const email = card.match(/^EMAIL[^:]*:(.*)$/im)?.[1]?.trim().toLowerCase() ?? '';
      if (phone || email) rows.push({ name: name || 'Unknown', phone, email, year: defaultYear, source: defaultSource, tags: [] });
    }
    return { rows, invalid, mapping: [], mode: 'text' };
  }
  for (const line of text.split(/\r?\n/)) {
    const emails = line.match(EMAIL_FIND) ?? [];
    const rest = line.replace(EMAIL_FIND, ' ');
    const phones = (rest.match(PHONE_FIND) ?? []).filter((p) => isPhone(p) && !isYear(p));
    if (!emails.length && !phones.length) continue;
    const name = rest.replace(PHONE_FIND, ' ').replace(/[^A-Za-z .'-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
    const y = Number(line.match(/\b20(2\d)\b/)?.[0]);
    rows.push({
      name: name || (emails[0] ? emails[0].split('@')[0] : 'Unknown'),
      phone: phones[0]?.trim() ?? '',
      email: (emails[0] ?? '').toLowerCase(),
      year: y >= 2020 && y <= 2029 ? y : defaultYear,
      source: matchSource(line) ?? defaultSource,
      tags: [],
    });
  }
  return { rows, invalid, mapping: [], mode: 'text' };
}

function splitDelimited(text: string): string[][] {
  const first = text.split(/\r?\n/, 5).join('\n');
  const delim = [',', '\t', ';', '|'].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const out: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); out.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  row.push(cell); out.push(row);
  return out;
}

/** Read any file the user drops in. */
export async function readLeadFile(file: File, defaultYear: number, defaultSource: string): Promise<SmartResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (['xlsx', 'xls', 'xlsm', 'xlsb', 'ods', 'numbers'].includes(ext)) {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const all: SmartResult = { rows: [], invalid: [], mapping: [], mode: 'table' };
    for (const name of wb.SheetNames) {
      const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: false, defval: '' });
      const r = parseGrid(grid, defaultYear, defaultSource);
      all.rows.push(...r.rows); all.invalid.push(...r.invalid);
      if (!all.mapping.length) all.mapping = r.mapping;
    }
    return all;
  }
  if (ext === 'pdf') {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    let text = '';
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      let lastY: number | null = null;
      for (const it of tc.items as { str: string; transform: number[] }[]) {
        const y = it.transform[5];
        text += lastY !== null && Math.abs(y - lastY) > 2 ? '\n' : ' ';
        text += it.str; lastY = y;
      }
      text += '\n';
    }
    return parseFreeText(text, defaultYear, defaultSource);
  }
  if (ext === 'docx') {
    const mammoth = await import('mammoth');
    const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return parseFreeText(value, defaultYear, defaultSource);
  }
  const text = await file.text();
  if (ext === 'json') {
    try {
      const data = JSON.parse(text);
      const arr: Record<string, unknown>[] = Array.isArray(data) ? data : (Object.values(data).find(Array.isArray) as Record<string, unknown>[]) ?? [];
      if (arr.length && typeof arr[0] === 'object') {
        const keys = Array.from(new Set(arr.flatMap((o) => Object.keys(o ?? {}))));
        return parseGrid([keys, ...arr.map((o) => keys.map((k) => o?.[k]))], defaultYear, defaultSource);
      }
    } catch { /* fall through */ }
    return parseFreeText(text, defaultYear, defaultSource);
  }
  if (ext === 'vcf') return parseFreeText(text, defaultYear, defaultSource);
  const grid = splitDelimited(text);
  const multiCol = grid.filter((r) => r.length > 1).length > grid.length / 2;
  const res = multiCol ? parseGrid(grid, defaultYear, defaultSource) : parseFreeText(text, defaultYear, defaultSource);
  return res;
}
