export const DOC_CATEGORIES = [
  "Proposal",
  "MOU Signed",
  "Payment Invoices",
  "College Tracker",
  "Invoices",
  "Pitch Deck",
  "MOU",
  "Welcome Letter",
  "Emailers",
  "Others",
] as const;

export type DocCategory = (typeof DOC_CATEGORIES)[number];

export const CATEGORY_COLORS: Record<string, string> = {
  "Proposal": "bg-primary/10 text-primary border-primary/30",
  "MOU Signed": "bg-success/10 text-success border-success/30",
  "Payment Invoices": "bg-success/10 text-success border-success/30",
  "College Tracker": "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  "Invoices": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  "Pitch Deck": "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30",
  "MOU": "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  "Welcome Letter": "bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/30",
  "Emailers": "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
  "Others": "bg-muted text-muted-foreground border-border",
};
