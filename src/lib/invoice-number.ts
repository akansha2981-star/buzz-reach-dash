import type { InvoiceType } from "./gst";

/** Legacy BSB numbers remain reserved; proformas have their own PF series. */
export function nextInvoiceNumber(
  type: InvoiceType,
  existing: readonly { invoice_number: string | null }[] = [],
  year = new Date().getFullYear(),
): string {
  const prefix = type === "proforma" ? `BSB-PF-${year}-` : `BSB-${year}-`;
  let max = 399;
  for (const invoice of existing) {
    const number = invoice.invoice_number;
    if (!number?.startsWith(prefix)) continue;
    const suffix = number.slice(prefix.length);
    if (!/^\d+$/.test(suffix)) continue;
    const sequence = Number(suffix);
    if (Number.isSafeInteger(sequence)) max = Math.max(max, sequence);
  }
  return `${prefix}${max + 1}`;
}