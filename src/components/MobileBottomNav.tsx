import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, GraduationCap, Calendar, ListChecks, Crown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { isAdmin, perms } = useAuth();
  const can = (k: keyof typeof perms) => isAdmin || perms[k];

  const items = [
    can("can_dashboard") && { to: "/", label: "Home", icon: LayoutDashboard, match: (p: string) => p === "/" },
    can("can_colleges") && { to: "/outreach/colleges", label: "Colleges", icon: GraduationCap, match: (p: string) => p.startsWith("/outreach") },
    can("can_meetings") && { to: "/meetings", label: "Meet", icon: Calendar, match: (p: string) => p.startsWith("/meetings") },
    { to: "/tasks", label: "Tasks", icon: ListChecks, match: (p: string) => p.startsWith("/tasks") },
    { to: "/ceo-desk", label: "CEO", icon: Crown, match: (p: string) => p.startsWith("/ceo-desk") },
  ].filter(Boolean) as { to: string; label: string; icon: typeof LayoutDashboard; match: (p: string) => boolean }[];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-stretch justify-around border-t bg-background/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {items.map((it) => {
        const active = it.match(path);
        const Icon = it.icon;
        return (
          <Link
            key={it.to}
            to={it.to}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="leading-none">{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
