import {
  Megaphone,
  Settings2,
  TrendingUp,
  Wallet,
  Users,
  Package,
  Palette,
  Code2,
  ClipboardList,
  Heart,
  Video,
  FlaskConical,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type MeCategoryDef = {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Solid gradient used for the active pill */
  gradient: string;
  /** Soft tone used for badges on cards */
  tone: string;
  /** Ring color used for focus/hover */
  ring: string;
  /** Hex dot for select fallback */
  dot: string;
};

export const ME_CATEGORY_DEFS: MeCategoryDef[] = [
  { key: "Marketing",   label: "Marketing",   icon: Megaphone,     gradient: "from-pink-500 to-rose-500",         tone: "bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/40",         ring: "ring-pink-500/40",       dot: "#ec4899" },
  { key: "Operations",  label: "Operations",  icon: Settings2,     gradient: "from-blue-500 to-indigo-500",       tone: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40",         ring: "ring-blue-500/40",       dot: "#3b82f6" },
  { key: "Sales",       label: "Sales",       icon: TrendingUp,    gradient: "from-emerald-500 to-green-500",     tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40", ring: "ring-emerald-500/40", dot: "#10b981" },
  { key: "Finance",     label: "Finance",     icon: Wallet,        gradient: "from-amber-500 to-orange-500",      tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40",     ring: "ring-amber-500/40",      dot: "#f59e0b" },
  { key: "HR",          label: "HR",          icon: Users,         gradient: "from-purple-500 to-violet-500",     tone: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/40", ring: "ring-purple-500/40",     dot: "#a855f7" },
  { key: "Product",     label: "Product",     icon: Package,       gradient: "from-indigo-500 to-blue-600",       tone: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/40", ring: "ring-indigo-500/40",     dot: "#6366f1" },
  { key: "Design",      label: "Design",      icon: Palette,       gradient: "from-fuchsia-500 to-pink-500",      tone: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/40", ring: "ring-fuchsia-500/40", dot: "#d946ef" },
  { key: "Engineering", label: "Engineering", icon: Code2,         gradient: "from-cyan-500 to-sky-500",          tone: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/40",         ring: "ring-cyan-500/40",       dot: "#06b6d4" },
  { key: "Admin",       label: "Admin",       icon: ClipboardList, gradient: "from-slate-500 to-zinc-600",        tone: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/40",     ring: "ring-slate-500/40",      dot: "#64748b" },
  { key: "Personal",    label: "Personal",    icon: Heart,         gradient: "from-teal-500 to-emerald-500",      tone: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/40",         ring: "ring-teal-500/40",       dot: "#14b8a6" },
  { key: "Meetings",    label: "Meetings",    icon: Video,         gradient: "from-orange-500 to-red-500",        tone: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/40", ring: "ring-orange-500/40",     dot: "#f97316" },
  { key: "Research",    label: "Research",    icon: FlaskConical,  gradient: "from-violet-500 to-purple-600",     tone: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/40", ring: "ring-violet-500/40",     dot: "#8b5cf6" },
  { key: "Other",       label: "Other",       icon: Sparkles,      gradient: "from-gray-400 to-gray-500",         tone: "bg-muted text-muted-foreground border-border",                               ring: "ring-muted-foreground/30", dot: "#9ca3af" },
];

export const ME_CATEGORIES = ME_CATEGORY_DEFS.map((c) => c.key);

export const CATEGORY_TONES: Record<string, string> = Object.fromEntries(
  ME_CATEGORY_DEFS.map((c) => [c.key, c.tone])
);

export function getCategoryDef(cat?: string | null): MeCategoryDef | undefined {
  if (!cat) return undefined;
  return ME_CATEGORY_DEFS.find((c) => c.key === cat);
}

export function categoryTone(cat?: string | null) {
  const def = getCategoryDef(cat);
  return def?.tone ?? "bg-muted text-muted-foreground border-border";
}
