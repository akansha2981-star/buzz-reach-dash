import { describe, expect, it } from "vitest";
import { accountingLinkedRows, invoiceDocumentStatus, isAccountingInvoice } from "./invoice-accounting";

describe("Proforma document-only accounting", () => {
  const invoices = [{ id: "pf", invoice_type: "proforma" }, { id: "tax", invoice_type: "tax" }, { id: "old", invoice_type: null }];
  it("excludes Proforma invoice amounts from financial totals", () => {
    expect(invoices.filter(isAccountingInvoice).map(i => i.id)).toEqual(["tax", "old"]);
  });
  it("excludes existing Proforma payments from income and bank balances", () => {
    const rows = [{ invoice_id: "pf", amount: 50000 }, { invoice_id: "tax", amount: 49000 }];
    expect(accountingLinkedRows(rows, invoices).reduce((s, r) => s + r.amount, 0)).toBe(49000);
  });
  it("excludes Proforma TDS while retaining manual TDS", () => {
    const rows = [{ invoice_id: "pf", amount: 1000 }, { invoice_id: "tax", amount: 1000 }, { invoice_id: null, amount: 500 }];
    expect(accountingLinkedRows(rows, invoices).reduce((s, r) => s + r.amount, 0)).toBe(1500);
  });
  it("prevents paid settlement statuses on Proformas", () => {
    for (const status of ["paid", "partially_paid", "paid_with_tds"]) expect(invoiceDocumentStatus("proforma", status)).toBe("sent");
    expect(invoiceDocumentStatus("tax", "paid_with_tds")).toBe("paid_with_tds");
  });
});