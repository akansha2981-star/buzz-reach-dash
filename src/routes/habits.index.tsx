import { createFileRoute } from "@tanstack/react-router";
import { MeShell } from "@/components/me/MeShell";
import { HabitsSection } from "@/components/habits/HabitsSection";

export const Route = createFileRoute("/habits/")({
  component: HabitsPage,
  head: () => ({
    meta: [
      { title: "Habit Tracker" },
      { name: "description", content: "Track habits, build streaks, and hit your daily goals." },
    ],
  }),
});

function HabitsPage() {
  return (
    <MeShell hideAddTask title="Habit Tracker" subtitle="Track anything, build streaks, achieve targets.">
      <HabitsSection />
    </MeShell>
  );
}
