import { describe, expect, it } from "vitest";
import { invoiceClientGstin } from "./invoice-client";

const client = { name: "Example College", email: "billing@example.com", phone: "9876543210", gstin: "09ABCDE1234F1Z5" };

describe("client GST identity for existing and future invoice PDFs", () => {
  it("resolves the saved GSTIN for an existing invoice by client name", () => {
    expect(invoiceClientGstin({ client: " example college " }, [client])).toBe("09ABCDE1234F1Z5");
  });
  it("reads an updated client GSTIN without rewriting the invoice", () => {
    expect(invoiceClientGstin({ client: client.name }, [{ ...client, gstin: "09ABCDE1234F2Z4" }])).toBe("09ABCDE1234F2Z4");
  });
  it("omits GSTIN for a client without one", () => {
    expect(invoiceClientGstin({ client: client.name }, [{ ...client, gstin: null }])).toBeNull();
  });
  it("does not use another client's GSTIN", () => {
    expect(invoiceClientGstin({ client: "Other College" }, [client])).toBeNull();
  });
  it("uses email to distinguish clients sharing a name", () => {
    expect(invoiceClientGstin({ client: client.name, client_email: client.email }, [client, { ...client, email: "other@example.com", gstin: "09ABCDE1234F2Z4" }])).toBe(client.gstin);
  });
  it("does not guess when duplicate names have different GSTINs", () => {
    expect(invoiceClientGstin({ client: client.name }, [client, { ...client, gstin: "09ABCDE1234F2Z4" }])).toBeNull();
  });
});