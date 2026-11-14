export const GST_RATE = 18;

/** Split a GST-inclusive amount into base and GST (18%). */
export function splitGst(total: number, applicable: boolean) {
  const t = Number(total) || 0;
  if (!applicable) return { base: t, gst: 0, total: t };
  const base = Math.round((t / (1 + GST_RATE / 100)) * 100) / 100;
  return { base, gst: Math.round((t - base) * 100) / 100, total: t };
}
export type GstMode = "none" | "inclusive" | "additional";
export const GST_COLLECTION_CAP = 200000;

/** Compute invoice base/GST/total from the entered item sum and GST mode. */
export function invoiceGst(entered: number, mode: GstMode) {
  const e = Math.round((Number(entered) || 0) * 100) / 100;
  if (mode === "inclusive") {
    const base = Math.round((e / (1 + GST_RATE / 100)) * 100) / 100;
    return { base, gst: Math.round((e - base) * 100) / 100, total: e };
  }
  if (mode === "additional") {
    const gst = Math.round(e * GST_RATE) / 100;
    return { base: e, gst, total: Math.round((e + gst) * 100) / 100 };
  }
  return { base: e, gst: 0, total: e };
}

export type GstWalletInvoice = { id: string; client: string; invoice_number: string | null; issue_date: string; amount: number; tax: number; total: number; gst_mode: string; status: string };
export type GstWalletPayment = { id: string; invoice_id?: string; amount: number; gst_applicable: boolean; paid_on?: string; received_on?: string; payer?: string | null; title?: string; reference?: string | null };
export type GstWalletRow = { id: string; company: string; reference: string; date: string; mode: string; base: number; gst: number; total: number };

/** GST invoices are counted once; linked payments must never count the same GST twice. */
export function gstWalletRows(invoices: GstWalletInvoice[], payments: GstWalletPayment[], income: GstWalletPayment[]): GstWalletRow[] {
  const byId = new Map(invoices.map(i => [i.id, i]));
  const covered = new Set(invoices.filter(i => i.gst_mode !== "none").map(i => i.id));
  const rows: GstWalletRow[] = invoices.filter(i => i.gst_mode !== "none" && i.status !== "cancelled").map(i => ({
    id: `invoice:${i.id}`, company: i.client, reference: i.invoice_number ?? "—", date: i.issue_date,
    mode: i.gst_mode, base: Number(i.amount), gst: Number(i.tax), total: Number(i.total),
  }));
  for (const p of payments) {
    const invoice = p.invoice_id ? byId.get(p.invoice_id) : undefined;
    if (!p.gst_applicable || (p.invoice_id && covered.has(p.invoice_id)) || invoice?.status === "cancelled") continue;
    rows.push({ id: `payment:${p.id}`, company: invoice?.client ?? "Invoice payment", reference: invoice?.invoice_number ?? p.reference ?? "—", date: p.paid_on ?? "", mode: "inclusive", ...splitGst(p.amount, true) });
  }
  for (const p of income) {
    if (!p.gst_applicable) continue;
    rows.push({ id: `income:${p.id}`, company: p.payer || p.title || "Other income", reference: p.reference || "Other income", date: p.received_on ?? "", mode: "inclusive", ...splitGst(p.amount, true) });
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}
