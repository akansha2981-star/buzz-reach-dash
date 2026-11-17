export const REQUIRED_DOCUMENTS = ["Proposal", "MOU Signed", "Welcome Letter", "Payment Invoices"] as const;
export type RequiredDocument = (typeof REQUIRED_DOCUMENTS)[number];

export function hasInstitutionDocuments(items: readonly unknown[]) {
  return items.length >= 1;
}

export function requiredDocument(category: string | null): RequiredDocument | undefined {
  const value = (category ?? "").trim().toLowerCase();
  if (value === "proposal") return "Proposal";
  if (["mou signed", "signed mou"].includes(value)) return "MOU Signed";
  if (value === "welcome letter") return "Welcome Letter";
  if (["invoices", "payment invoices", "payment invoice"].includes(value)) return "Payment Invoices";
}

export function documentCompleteness(items: { category: string | null }[], closed: boolean) {
  const present = new Set(items.map(item => requiredDocument(item.category)));
  const missing = REQUIRED_DOCUMENTS.filter(category => !present.has(category));
  return { missing, complete: missing.length === 0, needsAttention: closed && missing.length > 0 };
}

export function isClosedStage(stageId: string | null, stages: { id: string; name: string; position: number }[]) {
  if (!stageId || stages.length === 0) return false;
  const named = stages.filter(stage => /^(closed|deal closed|closed won|completed)$/i.test(stage.name.trim()));
  // Existing outreach screens use the final stage as the completed stage.
  const closedStages = named.length ? named : [...stages].sort((a, b) => b.position - a.position).slice(0, 1);
  return closedStages.some(stage => stage.id === stageId);
}