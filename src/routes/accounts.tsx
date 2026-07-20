import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { FileText, Receipt, Repeat, LayoutDashboard, Users, Landmark } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/accounts")({ component: AccountsLayout });

const TABS = [
  { to: "/accounts/summary", label: "Summary", icon: LayoutDashboard },
  { to: "/accounts/invoices", label: "Invoices", icon: FileText },
  { to: "/accounts/expenses", label: "Expenses", icon: Receipt },
  { to: "/accounts/recurring", label: "Recurring", icon: Repeat },
  { to: "/accounts/clients", label: "Clients", icon: Users },
  { to: "/accounts/bank-accounts", label: "Bank", icon: Landmark },
];

function AccountsLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <RequireAuth perm="can_accounts">
      <AppShell title="Accounts">
        <div className="mx-auto w-full max-w-6xl space-y-4">
          <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-border/60 bg-background/80 p-1 shadow-sm backdrop-blur-md">
            {TABS.map((t) => {
              const active = path.startsWith(t.to);
              return (
                <Link key={t.to} to={t.to} className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-all",
                  active ? "bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}>
                  <t.icon className="h-4 w-4" /><span>{t.label}</span>
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
