import { createFileRoute } from "@tanstack/react-router";
import { MeShell } from "@/components/me/MeShell";
import { ConfidentialSection } from "@/components/confidential/ConfidentialSection";

export const Route = createFileRoute("/me/confidential")({
  component: ConfidentialPage,
});

function ConfidentialPage() {
  return (
    <MeShell hideAddTask title="Confidential Vault" subtitle="Private documents, passwords, and API keys. Only you can see them.">
      <ConfidentialSection />
    </MeShell>
  );
}
