import type { Database } from "@/integrations/supabase/types";

export type LmsLead = Database["public"]["Tables"]["lms_leads"]["Row"];

export const LMS_YEARS = Array.from({ length: 10 }, (_, i) => 2020 + i); // 2020–2029

export type LeadInput = { name: string; phone: string; email: string };

export const normPhone = (v: string) => v.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
export const normEmail = (v: string) => v.trim().toLowerCase();

/** A row is a duplicate only when BOTH phone and email match an existing row. */
export function isFullDuplicate(candidate: LeadInput, existing: LeadInput[]): boolean {
  const phone = normPhone(candidate.phone);
  const email = normEmail(candidate.email);
  if (!phone || !email) return false;
  return existing.some((e) => normPhone(e.phone) === phone && normEmail(e.email) === email);
}

/** Split parsed rows into fresh rows and duplicates (against existing rows + within the batch). */
export function splitDuplicates(parsed: LeadInput[], existing: LeadInput[]) {
  const seen: LeadInput[] = [...existing];
  const fresh: LeadInput[] = [];
  const duplicates: LeadInput[] = [];
  for (const row of parsed) {
    if (isFullDuplicate(row, seen)) duplicates.push(row);
    else {
      fresh.push(row);
      seen.push(row);
    }
  }
  return { fresh, duplicates };
}

/** Parse CSV/TXT text with columns: name, phone, email (header row optional). */
export function parseLeadCsv(text: string): { rows: LeadInput[]; errors: string[] } {
  const rows: LeadInput[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  lines.forEach((line, idx) => {
    const parts = line.split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
    if (idx === 0 && /name/i.test(parts[0] ?? "") && /(phone|number|mobile)/i.test(parts[1] ?? "")) return; // header
    const [name = "", phone = "", email = ""] = parts;
    if (!name) {
      errors.push(`Line ${idx + 1}: missing name`);
      return;
    }
    if (!phone && !email) {
      errors.push(`Line ${idx + 1} (${name}): needs at least a number or an email`);
      return;
    }
    rows.push({ name, phone, email });
  });
  return { rows, errors };
}

export const LMS_CSV_TEMPLATE = "name,phone,email\nAarav Sharma,9876543210,aarav@example.com\nDiya Patel,9123456780,diya@example.com\n";
