// TEMPORARY: admin data export buttons. Remove with /api/admin/export.
import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PARTS = ["tables", "users", "files", "schema"] as const;

export function AdminExportButtons() {
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (part: string) => {
    setBusy(part);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch(`/api/admin/export?part=${part}`, {
        headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Failed (${res.status})`);
      const blob = await res.blob();
      const name = `export-${part}-${new Date().toISOString().slice(0, 10)}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally { setBusy(null); }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium">Export all data (admin):</span>
      {PARTS.map((p) => (
        <Button key={p} size="sm" variant="outline" disabled={busy !== null} onClick={() => run(p)}>
          <Download className="mr-1 h-4 w-4" />{busy === p ? "Exporting…" : p}
        </Button>
      ))}
    </div>
  );
}
