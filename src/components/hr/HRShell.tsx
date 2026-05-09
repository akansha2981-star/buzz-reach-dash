import { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Building2, ShieldAlert, Sparkles, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth";
import { useMyEmployee, HR_ROLES, type HRRole } from "@/lib/hr";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function HRShell({ children, title }: { children: ReactNode; title?: string }) {
  const { data: me, isLoading } = useMyEmployee();
  const { isAdmin: isAppAdmin } = useAuth();

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
