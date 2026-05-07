import { useEffect } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { Permissions } from "@/lib/access";
import { Button } from "@/components/ui/button";

export function RequireAuth({ children, perm }: { children: React.ReactNode; perm?: keyof Permissions }) {
  const { user, loading, perms, isAdmin } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);
  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (perm && !isAdmin && !perms[perm]) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <ShieldAlert className="h-10 w-10 text-muted-foreground" />
        <h2 className="font-display text-xl font-semibold">Access restricted</h2>
        <p className="max-w-sm text-sm text-muted-foreground">You don't have permission to view this section. Ask an admin to grant access.</p>
        <Button asChild variant="outline"><Link to="/">Back to dashboard</Link></Button>
      </div>
    );
  }
  return <>{children}</>;
}
