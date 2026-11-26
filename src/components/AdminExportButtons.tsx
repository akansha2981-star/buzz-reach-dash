// TEMPORARY: admin data export buttons. Remove with /api/admin/export.
import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PARTS = ["tables", "users", "files", "schema"] as const;

export function AdminExportButtons() {
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const get = async (qs: string) => {
    const { data } = await supabase.auth.getSession();
    const res = await fetch(`/api/admin/export?${qs}`, {
      headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    });
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `Failed (${res.status})`);
    return res;
  };
  const run = async (part: string) => {
    setBusy(part); setProgress("");
    try {
      let blob: Blob;
      if (part === "tables") {
        const tables: string[] = await (await get("part=list")).json();
        const out: Record<string, unknown[]> = {};
        for (const [i, t] of tables.entries()) {
          const rows: unknown[] = [];
          for (let offset = 0; ; offset += 5000) {
            setProgress(`${i + 1}/${tables.length} ${t} (${rows.length})`);
            const page: unknown[] = await (await get(`part=table&table=${t}&offset=${offset}`)).json();
            rows.push(...page);
            if (page.length < 5000) break;
          }
          out[t] = rows;
        }
        blob = new Blob([JSON.stringify(out)], { type: "application/json" });
      } else {
        blob = await (await get(`part=${part}`)).blob();
      }
      const name = `export-${part}-${new Date().toISOString().slice(0, 10)}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally { setBusy(null); setProgress(""); }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium">Export all data (admin):</span>
      {PARTS.map((p) => (
        <Button key={p} size="sm" variant="outline" disabled={busy !== null} onClick={() => run(p)}>
          <Download className="mr-1 h-4 w-4" />{busy === p ? `Exporting… ${progress}` : p}
        </Button>
      ))}
    </div>
  );
}
