export const ME_CATEGORIES = [
  "Marketing",
  "Operations",
  "Sales",
  "Finance",
  "HR",
  "Product",
  "Design",
  "Engineering",
  "Admin",
  "Personal",
  "Meetings",
  "Research",
  "Other",
] as const;

export type MeCategory = (typeof ME_CATEGORIES)[number];

export const CATEGORY_TONES: Record<string, string> = {
  Marketing: "bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/40",
  Operations: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40",
  Sales: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40",
  Finance: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40",
  HR: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/40",
  Product: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/40",
  Design: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/40",
  Engineering: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/40",
  Admin: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/40",
  Personal: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/40",
  Meetings: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/40",
  Research: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/40",
  Other: "bg-muted text-muted-foreground border-border",
};

export function categoryTone(cat?: string | null) {
  if (!cat) return CATEGORY_TONES.Other;
  return CATEGORY_TONES[cat] ?? CATEGORY_TONES.Other;
}
