import { describe, it, expect } from "vitest";
import { invoiceGst, gstWalletRows, type GstWalletInvoice } from "./gst";
describe("invoiceGst", () => {
  it("includes GST: 100 -> 84.75 + 15.25", () => expect(invoiceGst(100, "inclusive")).toEqual({ base: 84.75, gst: 15.25, total: 100 }));
  it("no GST: final amount only", () => expect(invoiceGst(100, "none")).toEqual({ base: 100, gst: 0, total: 100 }));
  it("additional GST adds 18%", () => expect(invoiceGst(100, "additional")).toEqual({ base: 100, gst: 18, total: 118 }));
});

describe("GST wallet previous payments", () => {
  const invoice: GstWalletInvoice = { id: "i1", client: "Company", invoice_number: "BSB-1", issue_date: "2026-11-14", amount: 100, tax: 18, total: 118, gst_mode: "additional", status: "paid", invoice_type: "tax" };
  it("excludes proformas displaying 18% GST", () => {
    expect(gstWalletRows([{ ...invoice, invoice_type: "proforma" }], [], [])).toEqual([]);
  });
  it("excludes GST-marked payments linked to proformas even without invoice GST", () => {
    expect(gstWalletRows([{ ...invoice, invoice_type: "proforma", gst_mode: "none" }], [{ id: "p1", invoice_id: "i1", amount: 118, gst_applicable: true }], [])).toEqual([]);
  });
  it("holds unclassified previous invoices out of GST until marked as tax", () => {
    expect(gstWalletRows([{ ...invoice, invoice_type: null }], [{ id: "p1", invoice_id: "i1", amount: 118, gst_applicable: true }], [])).toEqual([]);
  });
  it("reclassifying a previous proforma as tax includes GST once without changing its amounts", () => {
    const proforma = { ...invoice, invoice_type: "proforma" };
    const payment = { id: "p1", invoice_id: "i1", amount: 118, gst_applicable: true };
    expect(gstWalletRows([proforma], [payment], [])).toHaveLength(0);
    expect(gstWalletRows([{ ...proforma, invoice_type: "tax" }], [payment], []).reduce((sum, r) => sum + r.gst, 0)).toBe(18);
    expect(proforma.total).toBe(118);
  });
  it("automatically includes payments already marked GST inclusive", () => {
    expect(gstWalletRows([], [{ id: "p1", amount: 118, gst_applicable: true, paid_on: "2026-11-14" }], [])[0]).toMatchObject({ base: 100, gst: 18, total: 118 });
  });
  it("does not include unselected previous payments", () => {
    expect(gstWalletRows([], [{ id: "p1", amount: 118, gst_applicable: false }], [])).toHaveLength(0);
  });
  it("counts a GST bill once even when multiple linked payments include GST", () => {
    const rows = gstWalletRows([invoice], [{ id: "p1", invoice_id: "i1", amount: 59, gst_applicable: true }, { id: "p2", invoice_id: "i1", amount: 59, gst_applicable: true }], []);
    expect(rows).toHaveLength(1);
    expect(rows.reduce((s, r) => s + r.gst, 0)).toBe(18);
  });
  it("includes GST-marked manual income", () => {
    expect(gstWalletRows([], [], [{ id: "m1", payer: "Company", amount: 118, gst_applicable: true, received_on: "2026-11-14" }])[0]).toMatchObject({ company: "Company", base: 100, gst: 18 });
  });
  it("excludes cancelled invoice payments", () => {
    expect(gstWalletRows([{ ...invoice, gst_mode: "none", status: "cancelled" }], [{ id: "p1", invoice_id: "i1", amount: 118, gst_applicable: true }], [])).toHaveLength(0);
  });
});
