// Layout for /outreach/$type list path - delegates to colleges/coaching components based on param.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { InstituteListPage } from "@/components/InstituteListPage";

export const Route = createFileRoute("/outreach/$type")({ component: TypePage });

function TypePage() {
  const { type } = Route.useParams();
  const navigate = useNavigate();
  useEffect(() => {
    if (type !== "colleges" && type !== "coaching") navigate({ to: "/" });
  }, [type, navigate]);
  if (type === "colleges") return <InstituteListPage type="college" title="Colleges" subtitle="Manage outreach to college partners" />;
  if (type === "coaching") return <InstituteListPage type="coaching" title="Coaching Institutes" subtitle="Manage outreach to coaching partners" />;
  return null;
}
