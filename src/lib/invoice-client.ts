type ClientIdentity = { client: string; client_email?: string | null; client_phone?: string | null };
type ClientGstRecord = { name: string; email: string | null; phone: string | null; gstin: string | null };

const normalize = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

// Legacy invoices store client details rather than a directory ID.
export function invoiceClientGstin(invoice: ClientIdentity, clients: readonly ClientGstRecord[]): string | null {
  const matches = clients.filter(client => normalize(client.name) === normalize(invoice.client));
  const emailMatches = matches.filter(client => normalize(invoice.client_email) && normalize(client.email) === normalize(invoice.client_email));
  const phoneMatches = matches.filter(client => normalize(invoice.client_phone) && normalize(client.phone) === normalize(invoice.client_phone));
  const candidates = emailMatches.length ? emailMatches : phoneMatches.length ? phoneMatches : matches;
  const gstins = new Set(candidates.map(client => client.gstin?.trim() || null));
  return gstins.size === 1 ? candidates[0]?.gstin?.trim() || null : null;
}