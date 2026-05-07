import { createFileRoute } from "@tanstack/react-router";
import { InstituteListPage } from "@/components/InstituteListPage";

export const Route = createFileRoute("/outreach/colleges")({
  component: () => <InstituteListPage type="college" title="Colleges" subtitle="Manage outreach to college partners" />,
});
