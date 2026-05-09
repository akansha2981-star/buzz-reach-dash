import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  FileText, Link as LinkIcon, Upload, Plus, Trash2, ExternalLink, Download,
  FolderOpen, Search, Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRealtime } from "@/hooks/useRealtime";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DOC_CATEGORIES, CATEGORY_COLORS, type DocCategory } from "@/lib/document-categories";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";

const BUCKET = "institute-docs";
const ANY = "__any__";
const NONE = "__none__";

function formatBytes(b?: number | null) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function DocumentsPage() {
  useRealtime("institute_documents", [["docs-all"]]);
  useRealtime("institute_links", [["links-all"]]);
  const qc = useQueryClient();
  const { user } = useAuth();

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "college" | "coaching" | "general">("all");
  const [instituteFilter, setInstituteFilter] = useState<string>(ANY);
  const [categoryFilter, setCategoryFilter] = useState<string>(ANY);

  // Form state
  const [name, setName] = useState("");
  const [category, setCategory] = useState<DocCategory>("Others");
  const [linkedInstitute, setLinkedInstitute] = useState<string>(NONE);
  const [linkUrl, setLinkUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: institutes = [] } = useQuery({
    queryKey: ["all-institutes-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("institutes").select("id, name, type").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: docs = [] } = useQuery({
    queryKey: ["docs-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("institute_documents").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: links = [] } = useQuery({
    queryKey: ["links-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("institute_links").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const instMap = useMemo(() => {
    const m = new Map<string, { name: string; type: string }>();
    institutes.forEach((i: any) => m.set(i.id, { name: i.name, type: i.type }));
    return m;
  }, [institutes]);

  const filteredInstitutes = useMemo(() => {
    if (typeFilter === "college") return institutes.filter((i: any) => i.type === "college");
    if (typeFilter === "coaching") return institutes.filter((i: any) => i.type === "coaching");
    return institutes;
  }, [institutes, typeFilter]);

  function applyFilters<T extends { institute_id: string | null; category: string | null; label?: string; name?: string | null; url?: string }>(items: T[]) {
    return items.filter((it) => {
      if (typeFilter === "general" && it.institute_id) return false;
      if (typeFilter === "college" || typeFilter === "coaching") {
        if (!it.institute_id) return false;
        const inst = instMap.get(it.institute_id);
        if (!inst || inst.type !== typeFilter) return false;
      }
      if (instituteFilter !== ANY) {
        if (instituteFilter === NONE) {
          if (it.institute_id) return false;
        } else if (it.institute_id !== instituteFilter) return false;
      }
      if (categoryFilter !== ANY && (it.category ?? "Others") !== categoryFilter) return false;
      if (search.trim()) {
        const s = search.trim().toLowerCase();
        const hay = `${it.name ?? ""} ${it.label ?? ""} ${it.url ?? ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }

  const filteredDocs = useMemo(() => applyFilters(docs as any), [docs, typeFilter, instituteFilter, categoryFilter, search, instMap]);
  const filteredLinks = useMemo(() => applyFilters(links as any), [links, typeFilter, instituteFilter, categoryFilter, search, instMap]);

  const countsByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    DOC_CATEGORIES.forEach((c) => (counts[c] = 0));
    [...(docs as any[]), ...(links as any[])].forEach((it) => {
      const c = it.category ?? "Others";
      counts[c] = (counts[c] ?? 0) + 1;
    });
    return counts;
  }, [docs, links]);

  function resetForm() {
    setName(""); setLinkUrl(""); setCategory("Others"); setLinkedInstitute(NONE);
  }

  const addLink = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name is required");
      if (!linkUrl.trim()) throw new Error("URL is required");
      let url = linkUrl.trim();
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
      const { error } = await supabase.from("institute_links").insert({
        institute_id: linkedInstitute === NONE ? null : linkedInstitute,
        label: name.trim().slice(0, 200),
        name: name.trim().slice(0, 200),
        url: url.slice(0, 2000),
        category,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Link saved");
      resetForm();
      qc.invalidateQueries({ queryKey: ["links-all"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function handleFile(file: File) {
    if (!file) return;
    if (!name.trim()) { toast.error("Enter a document name first"); return; }
    if (file.size > 25 * 1024 * 1024) { toast.error("Max file size is 25 MB"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const folder = linkedInstitute === NONE ? "_general" : linkedInstitute;
      const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || undefined,
      });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("institute_documents").insert({
        institute_id: linkedInstitute === NONE ? null : linkedInstitute,
        label: name.trim().slice(0, 200),
        name: name.trim().slice(0, 200),
        category,
        file_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
        created_by: user?.id ?? null,
      });
      if (insErr) throw insErr;
      toast.success("Document uploaded");
      resetForm();
      qc.invalidateQueries({ queryKey: ["docs-all"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function openDoc(path: string) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 10);
    if (error || !data?.signedUrl) {
      toast.error(error?.message ?? "Could not open file");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  const delDoc = useMutation({
    mutationFn: async (d: any) => {
      await supabase.storage.from(BUCKET).remove([d.file_path]);
      const { error } = await supabase.from("institute_documents").delete().eq("id", d.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["docs-all"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const delLink = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("institute_links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["links-all"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 px-3 pb-6 pt-3 sm:px-4 md:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-xl font-semibold sm:text-2xl">Documents</h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Central library for trackers, invoices, MOUs, pitch decks & more — link or upload, with optional college/coaching tag.
        </p>
      </div>

      {/* Category quick chips */}
      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
        <button
          onClick={() => setCategoryFilter(ANY)}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            categoryFilter === ANY ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
          )}
        >
          All <span className="ml-1 opacity-70">{(docs.length + links.length) || 0}</span>
        </button>
        {DOC_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategoryFilter(c)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              categoryFilter === c
                ? "bg-primary text-primary-foreground border-primary"
                : cn(CATEGORY_COLORS[c], "hover:opacity-90")
            )}
          >
            {c} <span className="ml-1 opacity-70">{countsByCategory[c] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Add new */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4 text-primary" /> Add a document or link
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Name *</Label>
              <Input placeholder="e.g. IIM-A MOU draft" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as DocCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOC_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Link to (optional)</Label>
              <Select value={linkedInstitute} onValueChange={setLinkedInstitute}>
                <SelectTrigger><SelectValue placeholder="General (no institute)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>General (no institute)</SelectItem>
                  {institutes.map((i: any) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name} <span className="text-muted-foreground">· {i.type}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Paste a link</Label>
              <Input placeholder="https://…" value={linkUrl} maxLength={2000} onChange={(e) => setLinkUrl(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="flex-1 sm:flex-none"
              disabled={addLink.isPending || !name.trim() || !linkUrl.trim()}
              onClick={() => addLink.mutate()}
            >
              <LinkIcon className="mr-1 h-4 w-4" /> Save link
            </Button>
            <label className={cn(
              "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed bg-background px-3 py-2 text-sm hover:bg-accent",
              uploading && "opacity-60"
            )}>
              <Upload className="h-4 w-4" />
              <span>{uploading ? "Uploading…" : "Or upload a file (PDF, DOC, image…)"}</span>
              <input
                type="file"
                className="hidden"
                disabled={uploading}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/*"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
              />
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground">Max 25 MB per file. Name is required for both links and uploads.</p>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search by name or URL…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={typeFilter} onValueChange={(v: any) => { setTypeFilter(v); setInstituteFilter(ANY); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="college">Colleges only</SelectItem>
              <SelectItem value="coaching">Coaching only</SelectItem>
              <SelectItem value="general">General (no institute)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={instituteFilter} onValueChange={setInstituteFilter}>
            <SelectTrigger><SelectValue placeholder="Any institute" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any institute</SelectItem>
              <SelectItem value={NONE}>General only</SelectItem>
              {filteredInstitutes.map((i: any) => (
                <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <Filter className="mr-1 h-3.5 w-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All categories</SelectItem>
              {DOC_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Lists */}
      <Tabs defaultValue="files" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-flex">
          <TabsTrigger value="files">
            <FileText className="mr-1 h-4 w-4" /> Files <Badge variant="secondary" className="ml-2">{filteredDocs.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="links">
            <LinkIcon className="mr-1 h-4 w-4" /> Links <Badge variant="secondary" className="ml-2">{filteredLinks.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="mt-3">
          {filteredDocs.length === 0 ? (
            <EmptyState icon={FolderOpen} text="No files match your filters." />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {filteredDocs.map((d: any) => {
                const inst = d.institute_id ? instMap.get(d.institute_id) : null;
                return (
                  <li key={d.id} className="group flex items-center gap-2 rounded-lg border bg-card p-3 shadow-sm">
                    <FileText className="h-5 w-5 shrink-0 text-primary" />
                    <button onClick={() => openDoc(d.file_path)} className="min-w-0 flex-1 text-left">
                      <div className="truncate text-sm font-medium hover:text-primary">{d.name ?? d.label}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Badge variant="outline" className={cn("border", CATEGORY_COLORS[d.category ?? "Others"])}>{d.category ?? "Others"}</Badge>
                        {inst && <span className="truncate">· {inst.name} ({inst.type})</span>}
                        {!inst && <span>· General</span>}
                        <span>· {formatBytes(d.size_bytes)}</span>
                        <span>· {format(new Date(d.created_at), "MMM d")}</span>
                      </div>
                    </button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openDoc(d.file_path)} title="Download">
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 opacity-60 hover:opacity-100" onClick={() => delDoc.mutate(d)} title="Delete">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="links" className="mt-3">
          {filteredLinks.length === 0 ? (
            <EmptyState icon={LinkIcon} text="No links match your filters." />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {filteredLinks.map((l: any) => {
                const inst = l.institute_id ? instMap.get(l.institute_id) : null;
                return (
                  <li key={l.id} className="group flex items-center gap-2 rounded-lg border bg-card p-3 shadow-sm">
                    <ExternalLink className="h-5 w-5 shrink-0 text-primary" />
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium hover:text-primary">{l.name ?? l.label}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Badge variant="outline" className={cn("border", CATEGORY_COLORS[l.category ?? "Others"])}>{l.category ?? "Others"}</Badge>
                        {inst && <span className="truncate">· {inst.name} ({inst.type})</span>}
                        {!inst && <span>· General</span>}
                        <span className="truncate">· {l.url}</span>
                      </div>
                    </a>
                    <Button size="icon" variant="ghost" className="h-8 w-8 opacity-60 hover:opacity-100" onClick={() => delLink.mutate(l.id)} title="Delete">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 py-10 text-center">
      <Icon className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

export const Route = createFileRoute("/documents")({
  component: () => (
    <RequireAuth>
      <AppShell title="Documents">
        <DocumentsPage />
      </AppShell>
    </RequireAuth>
  ),
});
