import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { CalendarDays, ListChecks, LayoutGrid, Timer, Target, BarChart3, Sparkles } from "lucide-react";
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
  { to: "/me/habits", label: "Habits", icon: Target },
  { to: "/me/analytics", label: "Analytics", icon: BarChart3 },
];

function MeLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <RequireAuth>
      <AppShell title="My Workspace">
        <div className="mx-auto w-full max-w-6xl space-y-4">
          <nav className="-mx-1 flex gap-1 overflow-x-auto rounded-2xl border bg-card/60 p-1 backdrop-blur-sm shadow-sm">
            {TABS.map((t) => {
              const active = t.exact ? path === t.to : path.startsWith(t.to);
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all sm:text-sm",
                    active
                      ? "bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <t.icon className="h-4 w-4" />
                  {t.label}
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
