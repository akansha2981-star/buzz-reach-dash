import { createFileRoute } from "@tanstack/react-router";
import { TdsSection } from "@/components/accounts/TdsSection";

export const Route = createFileRoute("/accounts/tds")({
  component: TdsSection,
  head: () => ({ meta: [
    { title: "TDS | Works Accounts" },
    { name: "description", content: "Manage dated TDS amounts and company records in Works Accounts." },
    { property: "og:title", content: "TDS | Works Accounts" },
    { property: "og:description", content: "Manage dated TDS amounts and company records in Works Accounts." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});
