import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";

export const Route = createFileRoute("/habits")({
  component: HabitsLayout,
});

function HabitsLayout() {
  return (
    <RequireAuth>
      <AppShell title="Habit Tracker">
        <div className="mx-auto w-full max-w-6xl space-y-4 px-1 sm:px-0">
          <Outlet />
        </div>
      </AppShell>
    </RequireAuth>
  );
}
