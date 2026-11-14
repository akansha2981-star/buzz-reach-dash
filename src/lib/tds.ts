/** Split an invoice settlement into bank receipt and TDS deducted by the client. */
export function splitTdsSettlement(due: number, bank: number, tds: number) {
  const b = Math.max(0, Number(bank) || 0);
  const t = Math.max(0, Number(tds) || 0);
  const settled = Math.round((b + t) * 100) / 100;
  const remaining = Math.max(0, Math.round((due - settled) * 100) / 100);
  return { bank: b, tds: t, settled, remaining, fullyPaid: settled + 0.01 >= due, overpaid: settled > due + 0.01 };
}
/** Bank part given the TDS part (e.g. due 50,000, TDS 1,000 -> bank 49,000). */
export const bankFromTds = (due: number, tds: number) => Math.max(0, Math.round((due - (Number(tds) || 0)) * 100) / 100);
