export const GST_RATE = 18;

/** Split a GST-inclusive amount into base and GST (18%). */
export function splitGst(total: number, applicable: boolean) {
  const t = Number(total) || 0;
  if (!applicable) return { base: t, gst: 0, total: t };
  const base = Math.round((t / (1 + GST_RATE / 100)) * 100) / 100;
  return { base, gst: Math.round((t - base) * 100) / 100, total: t };
}