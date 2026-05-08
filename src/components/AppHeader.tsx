import { useEffect, useState } from "react";
import { Moon, Sun, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { InstallAppButton } from "@/components/InstallAppButton";
import { cn } from "@/lib/utils";

export function AppHeader({ title }: { title?: string }) {
  const { theme, toggle } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-2 border-b px-3 transition-all sm:px-4",
          "md:sticky md:left-auto md:right-auto",
          scrolled
            ? "bg-background/85 shadow-sm backdrop-blur-xl supports-[backdrop-filter]:bg-background/70"
            : "bg-background/95 backdrop-blur-md"
        )}
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <SidebarTrigger />
        <h1 className="min-w-0 flex-1 truncate font-display text-base font-semibold tracking-tight sm:text-lg">
          {title ?? "Dashboard"}
        </h1>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <InstallAppButton />
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          {user && (
            <>
              <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate({ to: "/auth" });
                }}
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </header>
      {/* Spacer to offset fixed header on mobile */}
      <div
        aria-hidden
        className="h-14 md:hidden"
        style={{ height: "calc(3.5rem + env(safe-area-inset-top))" }}
      />
    </>
  );
}
