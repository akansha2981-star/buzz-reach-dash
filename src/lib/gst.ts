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
