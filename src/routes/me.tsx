import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { CalendarDays, ListChecks, Timer, BarChart3, Sparkles, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/me")({
  component: MeLayout,
});

const TABS = [
  { to: "/me", label: "Today", icon: Sparkles, exact: true },
  { to: "/me/tasks", label: "Tasks", icon: ListChecks },
  { to: "/me/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/me/focus", label: "Focus", icon: Timer },
  { to: "/me/confidential", label: "Vault", icon: ShieldCheck },
  { to: "/me/analytics", label: "Analytics", icon: BarChart3 },
];

function MeLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <RequireAuth>
      <AppShell title="My Workspace">
        <div className="mx-auto w-full max-w-6xl space-y-4 px-1 sm:px-0">
          <nav className="sticky top-0 z-30 -mx-1 flex gap-1 overflow-x-auto rounded-2xl border border-border/60 bg-background/80 p-1 shadow-sm backdrop-blur-md scrollbar-hide">
            {TABS.map((t) => {
              const active = t.exact ? path === t.to : path.startsWith(t.to);
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className={cn(
                    "group flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium transition-all sm:px-3.5 sm:text-sm",
                    active
                      ? "bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  aria-label={t.label}
                >
                  <t.icon className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">{t.label}</span>
                </Link>
              );
            })}
          </nav>
          <Outlet />
        </div>
      </AppShell>
    </RequireAuth>
  );
}
