import { describe, it, expect } from "vitest";
import { splitTdsSettlement, bankFromTds } from "./tds";
describe("TDS settlement", () => {
  it("49,000 bank + 1,000 TDS fully pays a 50,000 invoice", () => {
    const r = splitTdsSettlement(50000, 49000, 1000);
    expect(r.settled).toBe(50000); expect(r.fullyPaid).toBe(true); expect(r.remaining).toBe(0);
  });
  it("bank amount is auto-filled from TDS", () => { expect(bankFromTds(50000, 1000)).toBe(49000); });
  it("short settlement leaves remainder", () => { expect(splitTdsSettlement(50000, 40000, 1000).remaining).toBe(9000); });
});
