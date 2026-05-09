import { createFileRoute, Navigate } from "@tanstack/react-router";
import { HRShell } from "@/components/hr/HRShell";
import { useMyEmployee } from "@/lib/hr";

export const Route = createFileRoute("/hrms/me")({
  component: () => (
    <HRShell title="My Profile & Documents">
      <MeRedirect />
    </HRShell>
  ),
});

function MeRedirect() {
  const { data: me, isLoading } = useMyEmployee();
  if (isLoading) return <div className="py-20 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!me) return <div className="py-20 text-center text-sm text-muted-foreground">No employee profile yet. Ask your HR admin to add you.</div>;
  return <Navigate to="/hrms/employees/$id" params={{ id: me.id }} replace />;
}
