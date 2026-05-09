import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Search, Shield, Download, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { HRShell } from "@/components/hr/HRShell";
import { useMyEmployee, isHRAdminRole } from "@/lib/hr";

export const Route = createFileRoute("/hrms/admin/audit")({
  component: () => <HRShell title="Audit Log"><AuditPage /></HRShell>,
});

function AuditPage() {
  const { data: me } = useMyEmployee();
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(100);

  const { data: logs = [], refetch, isFetching } = useQuery({
    queryKey: ["audit-logs", limit],
    enabled: !!me && isHRAdminRole(me.hr_role),
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = logs.filter((l: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return [l.action, l.entity_type, l.entity_label, l.actor_email].some((f) => (f ?? "").toLowerCase().includes(s));
  });

  const exportCSV = () => {
    const rows = [["Time", "Actor", "Action", "Entity Type", "Entity Label"], ...filtered.map((l: any) => [
      format(new Date(l.created_at), "yyyy-MM-dd HH:mm:ss"), l.actor_email ?? "", l.action ?? "", l.entity_type ?? "", l.entity_label ?? "",
    ])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "audit-log.csv"; a.click(); URL.revokeObjectURL(url);
  };

  if (me && !isHRAdminRole(me.hr_role)) {
    return <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Admins only.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2"><Shield className="h-5 w-5" />Audit Log</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} events</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search action, actor…" className="h-9 w-56 pl-7" />
          </div>
          <Button variant="outline" size="sm" onClick={() => setLimit((l) => l + 100)}>Load more</Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className={isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} /></Button>
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="mr-1 h-4 w-4" />CSV</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Time</th>
                  <th className="px-3 py-2 text-left">Actor</th>
                  <th className="px-3 py-2 text-left">Action</th>
                  <th className="px-3 py-2 text-left">Entity</th>
                  <th className="px-3 py-2 text-left">Label</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l: any) => (
                  <tr key={l.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{format(new Date(l.created_at), "MMM d, HH:mm:ss")}</td>
                    <td className="px-3 py-2 text-xs">{l.actor_email ?? "—"}</td>
                    <td className="px-3 py-2"><Badge variant="outline" className="font-mono text-[10px]">{l.action}</Badge></td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{l.entity_type ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">{l.entity_label ?? "—"}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-12 text-center text-sm text-muted-foreground">No audit events found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
