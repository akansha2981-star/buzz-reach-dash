export const PRIORITY_OPTIONS = [1, 2, 3, 4, 5] as const;

export const PRIORITY_META: Record<number, { label: string; color: string; bg: string; border: string }> = {
  1: { label: "P1 · Critical", color: "#dc2626", bg: "#fee2e2", border: "#fecaca" },
  2: { label: "P2 · High", color: "#ea580c", bg: "#ffedd5", border: "#fed7aa" },
  3: { label: "P3 · Medium", color: "#ca8a04", bg: "#fef9c3", border: "#fde68a" },
  4: { label: "P4 · Low", color: "#0284c7", bg: "#e0f2fe", border: "#bae6fd" },
  5: { label: "P5 · Backlog", color: "#6b7280", bg: "#f3f4f6", border: "#e5e7eb" },
};

export function priorityShort(p?: number | null) {
  return p ? `P${p}` : "—";
}
