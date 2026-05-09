import { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Building2, ShieldAlert, Sparkles, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useMyEmployee, isManagerRole, HR_ROLES, type HRRole } from "@/lib/hr";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Clock, CalendarDays, Users, ClipboardList, FileText, TrendingUp, ListChecks, Megaphone, BarChart3, Shield,
} from "lucide-react";

type Tab = { to: string; label: string; icon: any; exact?: boolean; manager?: boolean; admin?: boolean };
const TABS: Tab[] = [
  { to: "/hrms", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/hrms/attendance", label: "Attendance", icon: Clock },
  { to: "/hrms/leaves", label: "Leaves", icon: CalendarDays },
  { to: "/hrms/productivity", label: "Productivity", icon: TrendingUp },
  { to: "/hrms/tasks", label: "Tasks", icon: ListChecks },
  { to: "/hrms/announcements", label: "Announcements", icon: Megaphone },
  { to: "/hrms/employees", label: "Employees", icon: Users, manager: true },
  { to: "/hrms/admin/leaves", label: "Approvals", icon: ClipboardList, manager: true },
  { to: "/hrms/admin/attendance", label: "Org Attendance", icon: FileText, manager: true },
  { to: "/hrms/admin/analytics", label: "Analytics", icon: BarChart3, admin: true },
  { to: "/hrms/admin/audit", label: "Audit Log", icon: Shield, admin: true },
];

export function HRShell({ children, title }: { children: ReactNode; title?: string }) {
  const { data: me, isLoading } = useMyEmployee();
  const { isAdmin: isAppAdmin } = useAuth();
  const path = useRouterState({ select: (r) => r.location.pathname });

  // Synthetic profile so app-level admins can use the HR module even before
  // their hr_employees row exists (so they can create the first employees).
  const effectiveMe: { id: string; hr_role: HRRole; status: "active" | "suspended" | "inactive"; full_name: string } | null =
    me ?? (isAppAdmin
      ? { id: "", hr_role: "super_admin", status: "active", full_name: "Admin" }
      : null);

  return (
    <RequireAuth>
      <AppShell title={title ?? "HR"}>
        {isLoading ? (
          <div className="py-20 text-center text-sm text-muted-foreground">Loading HR profile…</div>
        ) : !effectiveMe ? (
          <NoEmployeeProfile />
        ) : effectiveMe.status !== "active" ? (
          <SuspendedNotice />
        ) : (
          <div className="space-y-4">
            {/* HR module nav */}
            <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
              <div className="inline-flex min-w-full gap-1 rounded-xl border bg-card p-1 shadow-sm">
                {TABS.filter((t) => (!t.manager || isManagerRole(effectiveMe.hr_role)) && (!t.admin || effectiveMe.hr_role === "super_admin" || effectiveMe.hr_role === "hr_admin")).map((t) => {
                  const active = t.exact ? path === t.to : path.startsWith(t.to);
                  const Icon = t.icon;
                  return (
                    <Link
                      key={t.to}
                      to={t.to as any}
                      className={cn(
                        "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                        active ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {t.label}
                    </Link>
                  );
                })}
              </div>
            </div>
            {!me && isAppAdmin && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                You don't have an HR employee record yet. Use Employees → Add Employee to add yourself.
              </div>
            )}
            {children}
          </div>
        )}
      </AppShell>
    </RequireAuth>
  );
}

export function HRRoleBadge({ role }: { role: HRRole }) {
  const cfg = HR_ROLES.find((r) => r.value === role);
  return <Badge variant="outline" className={cn("border", cfg?.tone)}>{cfg?.label ?? role}</Badge>;
}

function NoEmployeeProfile() {
  const qc = useQueryClient();
  return (
    <div className="mx-auto max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
      <Building2 className="mx-auto h-10 w-10 text-muted-foreground" />
      <h2 className="mt-3 font-display text-lg font-semibold">No HR profile found</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        We couldn't load your employee record. If your admin just added you, click Refresh.
      </p>
      <p className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Sparkles className="h-3 w-3" /> Otherwise, ask your HR admin to add you.
      </p>
      <div className="mt-4 flex items-center justify-center gap-2">
        <Button size="sm" variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["hr-me"] })}>
          <RefreshCw className="mr-1 h-4 w-4" /> Refresh
        </Button>
        <Button asChild size="sm">
          <Link to="/hrms/employees">Open Directory</Link>
        </Button>
      </div>
    </div>
  );
}

function SuspendedNotice() {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
      <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
      <h2 className="mt-3 font-display text-lg font-semibold">Account suspended</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Your HR account is currently inactive. Please contact your HR admin.
      </p>
    </div>
  );
}
