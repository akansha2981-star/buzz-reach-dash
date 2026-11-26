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
        const counts: Record<string, number | null> = await (await get("part=schema")).json();
        const jobs: { t: string; offset: number }[] = [];
        for (const [t, c] of Object.entries(counts)) {
          for (let offset = 0; offset < Math.max(c ?? 0, 1); offset += 5000) jobs.push({ t, offset });
        }
        const chunks = new Map<string, unknown[]>();
        let done = 0, next = 0;
        const worker = async () => {
          while (next < jobs.length) {
            const job = jobs[next++];
            const page: unknown[] = await (await get(`part=table&table=${job.t}&offset=${job.offset}`)).json();
            chunks.set(`${job.t}:${job.offset}`, page);
            setProgress(`${Math.round((++done / jobs.length) * 100)}%`);
          }
        };
        setProgress("0%");
        await Promise.all(Array.from({ length: 6 }, worker));
        const out: Record<string, unknown[]> = {};
        for (const { t, offset } of jobs) (out[t] ??= []).push(...(chunks.get(`${t}:${offset}`) ?? []));
        const missing = Object.entries(counts).filter(([t, c]) => c != null && (out[t]?.length ?? 0) < c);
        if (missing.length) throw new Error(`Incomplete export: ${missing.map(([t]) => t).join(", ")}`);
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
      console.error("[export]", e);
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
