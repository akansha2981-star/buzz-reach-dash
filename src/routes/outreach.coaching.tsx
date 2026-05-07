import { createFileRoute } from "@tanstack/react-router";
import { InstituteListPage } from "@/components/InstituteListPage";

export const Route = createFileRoute("/outreach/coaching")({
  component: () => <InstituteListPage type="coaching" title="Coaching Institutes" subtitle="Manage outreach to coaching partners" />,
});
