import { describe, expect, it } from "vitest";
import { documentCompleteness, isClosedStage } from "./document-completeness";

describe("required institution documents", () => {
  const complete = ["Proposal", "MOU Signed", "Welcome Letter", "Payment Invoices"].map(category => ({ category }));
  for (const category of ["Proposal", "MOU Signed", "Welcome Letter", "Payment Invoices"]) {
    it(`flags a closed institution missing ${category}`, () => {
      const result = documentCompleteness(complete.filter(item => item.category !== category), true);
      expect(result.missing).toEqual([category]);
      expect(result.needsAttention).toBe(true);
    });
  }
  it("does not warn for a fully documented closed institution", () => {
    expect(documentCompleteness(complete, true).needsAttention).toBe(false);
  });
  it("does not warn in red for an open institution", () => {
    expect(documentCompleteness([], false).needsAttention).toBe(false);
  });
  it("does not treat an unsigned MOU as signed", () => {
    expect(documentCompleteness([{ category: "MOU" }], true).missing).toContain("MOU Signed");
  });
  it("preserves existing invoice categorization", () => {
    expect(documentCompleteness([{ category: "Invoices" }], true).missing).not.toContain("Payment Invoices");
  });
  it("recognizes a named closed stage, not unrelated stages", () => {
    const stages = [{ id: "closed", name: "Closed", position: 2 }, { id: "lost", name: "Lost", position: 3 }];
    expect(isClosedStage("closed", stages)).toBe(true);
    expect(isClosedStage("lost", stages)).toBe(false);
    expect(isClosedStage(null, stages)).toBe(false);
  });
});