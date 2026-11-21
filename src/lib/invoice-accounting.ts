type AccountingInvoice = { id: string; invoice_type?: string | null };

/** Unclassified legacy invoices retain their accounting treatment; proformas do not. */
export function isAccountingInvoice(invoice: { invoice_type?: string | null } | null | undefined): boolean {
  return !!invoice && invoice.invoice_type !== "proforma";
}

export function accountingLinkedRows<T extends { invoice_id: string | null }>(rows: T[], invoices: AccountingInvoice[]): T[] {
  const eligible = new Set(invoices.filter(isAccountingInvoice).map(i => i.id));
  return rows.filter(row => row.invoice_id === null || eligible.has(row.invoice_id));
}

export function invoiceDocumentStatus(type: string, status: string): string {
  return type === "proforma" && ["paid", "partially_paid", "paid_with_tds"].includes(status) ? "sent" : status;
}