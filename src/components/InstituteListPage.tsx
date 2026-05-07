import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, MapPin, Globe } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { CreateInstituteDialog } from "@/components/CreateInstituteDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchInstitutes, fetchStages, type InstituteType } from "@/lib/data";

export function InstituteListPage({ type, title, subtitle }: { type: InstituteType; title: string; subtitle: string }) {
  const { data: list = [] } = useQuery({ queryKey: ["institutes", type], queryFn: () => fetchInstitutes(type) });
  const { data: stages = [] } = useQuery({ queryKey: ["stages"], queryFn: fetchStages });
  const [q, setQ] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");

  const filtered = useMemo(() => list.filter((i) => {
    const m = q.trim().toLowerCase();
    if (stageFilter !== "all" && i.current_stage_id !== stageFilter) return false;
    if (!m) return true;
    return [i.name, i.city, i.state, i.contact_person].some((v) => v?.toLowerCase().includes(m));
  }), [list, q, stageFilter]);

  return (
    <RequireAuth>
      <AppShell title={title}>
        <div className="space-y-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h2 className="font-display text-2xl font-bold">{title}</h2>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
            <CreateInstituteDialog type={type} />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search by name, city, state…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="sm:w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {stages.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <Card><CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-muted-foreground">No profiles yet.</p>
            </CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((i) => {
                const stage = stages.find((s) => s.id === i.current_stage_id);
                const idx = stage ? stages.findIndex((s) => s.id === stage.id) + 1 : 0;
                const pct = stages.length ? Math.round((idx / stages.length) * 100) : 0;
                return (
                  <Link key={i.id} to="/outreach/$type/$id" params={{ type: type === "college" ? "colleges" : "coaching", id: i.id }}>
                    <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-lg" style={{ boxShadow: "var(--shadow-card)" }}>
                      <CardContent className="space-y-3 p-5">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-display text-lg font-semibold leading-tight">{i.name}</h3>
                          {stage && <Badge style={{ background: `${stage.color}20`, color: stage.color, borderColor: `${stage.color}40` }} variant="outline">{stage.name}</Badge>}
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {(i.city || i.state) && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{[i.city, i.state].filter(Boolean).join(", ")}</span>}
                          {i.website && <span className="flex items-center gap-1"><Globe className="h-3 w-3" />Website</span>}
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs"><span className="text-muted-foreground">Progress</span><span className="font-medium">{pct}%</span></div>
                          <Progress value={pct} className="h-1.5" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
