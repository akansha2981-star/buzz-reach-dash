import { describe, expect, it } from "vitest";
import { nextInvoiceNumber } from "./invoice-number";

describe("separate Tax and Proforma series", () => {
  it("advances each series independently", () => {
    const invoices = [
      { invoice_number: "BSB-2026-407" },
      { invoice_number: "BSB-PF-2026-402" },
    ];
    expect(nextInvoiceNumber("tax", invoices, 2026)).toBe("BSB-2026-408");
    expect(nextInvoiceNumber("proforma", invoices, 2026)).toBe("BSB-PF-2026-403");
  });
  it("starts an unused series at 400 without being advanced by the other", () => {
    expect(nextInvoiceNumber("proforma", [{ invoice_number: "BSB-2026-450" }], 2026)).toBe("BSB-PF-2026-400");
    expect(nextInvoiceNumber("tax", [{ invoice_number: "BSB-PF-2026-450" }], 2026)).toBe("BSB-2026-400");
  });
  it("resets for a new year and ignores malformed numbers", () => {
    const invoices = [{ invoice_number: "BSB-2025-999" }, { invoice_number: "BSB-2026-900draft" }, { invoice_number: null }];
    expect(nextInvoiceNumber("tax", invoices, 2026)).toBe("BSB-2026-400");
  });
});