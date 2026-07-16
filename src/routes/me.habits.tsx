import { createFileRoute } from "@tanstack/react-router";
import { MeShell } from "@/components/me/MeShell";
import { HabitsSection } from "@/components/habits/HabitsSection";

export const Route = createFileRoute("/me/habits")({
  component: HabitsPage,
});

function HabitsPage() {
  return (
    <MeShell title="Habits" subtitle="Track anything, build streaks, achieve targets.">
      <HabitsSection />
    </MeShell>
  );
}
