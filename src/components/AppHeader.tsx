import { Moon, Sun, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { InstallAppButton } from "@/components/InstallAppButton";

export function AppHeader({ title }: { title?: string }) {
  const { theme, toggle } = useTheme();
  const { user } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur-md sm:px-4">
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
  );
}
