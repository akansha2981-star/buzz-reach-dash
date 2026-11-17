import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  FileText, Link as LinkIcon, Upload, Plus, Trash2, ExternalLink, Download,
  FolderOpen, Search, Filter, GraduationCap, BookOpen, CheckCircle2, AlertTriangle, Circle, ChevronDown,
} from "lucide-react";
import { CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { REQUIRED_DOCUMENTS, documentCompleteness, isClosedStage, hasInstitutionDocuments } from "@/lib/document-completeness";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRealtime } from "@/hooks/useRealtime";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DOC_CATEGORIES, type DocCategory } from "@/lib/document-categories";
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
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [adding, setAdding] = useState(false);
  useRealtime("institutes", [["document-institutes"]]);
  useRealtime("outreach_stages", [["document-stages"]]);

  // Form state
  const [name, setName] = useState("");
  const [category, setCategory] = useState<DocCategory>("Others");
  const [linkedInstitute, setLinkedInstitute] = useState<string>(NONE);
  const [linkUrl, setLinkUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: institutes = [], isPending: institutesPending, error: institutesError } = useQuery({
    queryKey: ["document-institutes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("institutes").select("id, name, type, current_stage_id").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: stages = [], isPending: stagesPending, error: stagesError } = useQuery({
    queryKey: ["document-stages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("outreach_stages").select("id, name, position").order("position");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: docs = [], isPending: docsPending, error: docsError } = useQuery({
    queryKey: ["docs-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("institute_documents").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: links = [], isPending: linksPending, error: linksError } = useQuery({
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
        const hay = `${it.name ?? ""} ${it.label ?? ""} ${it.url ?? ""} ${it.institute_id ? instMap.get(it.institute_id)?.name ?? "" : "General"}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }

  const filteredDocs = useMemo(() => applyFilters(docs), [docs, typeFilter, instituteFilter, categoryFilter, search, instMap]);
  const filteredLinks = useMemo(() => applyFilters(links), [links, typeFilter, instituteFilter, categoryFilter, search, instMap]);

  const groups = useMemo(() => institutes.map(institute => {
    const allItems = [...docs, ...links].filter(item => item.institute_id === institute.id);
    const status = documentCompleteness(allItems, isClosedStage(institute.current_stage_id, stages));
    return { ...institute, ...status, allItems, files: filteredDocs.filter(item => item.institute_id === institute.id), links: filteredLinks.filter(item => item.institute_id === institute.id) };
  }).filter(group => hasInstitutionDocuments(group.allItems)), [institutes, docs, links, stages, filteredDocs, filteredLinks]);
  const filteredInstitutes = groups.filter(group => typeFilter === "all" || typeFilter === group.type);
  const attentionCount = groups.filter(group => group.needsAttention).length;
  const visibleGroups = groups.filter(group => {
    if (typeFilter === "general") return false;
    if (typeFilter !== "all" && typeFilter !== group.type) return false;
    if (instituteFilter !== ANY && instituteFilter !== group.id) return false;
    if (attentionOnly && !group.needsAttention) return false;
    if (categoryFilter !== ANY && !group.files.length && !group.links.length) return false;
    if (search.trim() && !group.name.toLowerCase().includes(search.trim().toLowerCase()) && !group.files.length && !group.links.length) return false;
    return true;
  });
  const loading = institutesPending || docsPending || linksPending || stagesPending;
  const loadError = institutesError || docsError || linksError || stagesError;

  function addRequired(instituteId: string, category: DocCategory) {
    setLinkedInstitute(instituteId); setCategory(category); setName(category); setAdding(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Documents</h1>
          <p className="mt-1 text-sm text-muted-foreground">College & coaching records</p>
        </div>
        <Button onClick={() => setAdding(!adding)}><Plus className="mr-2 h-4 w-4" />Add document</Button>
      </div>
      <div className="grid grid-cols-2 gap-4 border-y py-4 sm:grid-cols-4">
        {[{ label: "Colleges", value: groups.filter(i => i.type === "college").length, icon: GraduationCap }, { label: "Coaching institutes", value: groups.filter(i => i.type === "coaching").length, icon: BookOpen }, { label: "Files & links", value: docs.length + links.length, icon: FolderOpen }, { label: "Closed · missing documents", value: attentionCount, icon: AlertTriangle }].map(stat => (
          <div key={stat.label} className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><stat.icon className="h-4 w-4 shrink-0" />{stat.label}</div>
            <p className={cn("mt-2 text-2xl font-semibold tabular-nums", stat.icon === AlertTriangle && attentionCount > 0 && "text-destructive")}>{loading ? "—" : stat.value}</p>
          </div>
        ))}
      </div>

      {/* Add new */}
      {adding && <section className="border-b py-3">
        <div className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4 text-primary" /> Add a document or link
          </CardTitle>
        </div>
        <div className="space-y-3">
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
        </div>
      </section>}

      {/* Filters */}
      <section className="space-y-3 py-2">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search institutions or documents…" value={search} onChange={(e) => setSearch(e.target.value)} />
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
        </div>
        <Button size="sm" variant={attentionOnly ? "destructive" : "outline"} onClick={() => setAttentionOnly(!attentionOnly)} aria-pressed={attentionOnly}>
          <AlertTriangle className="mr-2 h-4 w-4" />Closed with missing documents ({attentionCount})
        </Button>
      </section>

      {loadError ? <div role="alert" className="border border-destructive/30 p-4 text-destructive">Could not load documents. <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries()}>Retry</Button></div> : loading ? <p className="py-10 text-center text-muted-foreground">Loading institution records…</p> : <>
        {(["college", "coaching"] as const).map(type => {
          const list = visibleGroups.filter(group => group.type === type);
          if (!list.length) return null;
          const Icon = type === "college" ? GraduationCap : BookOpen;
          return <section key={type} className="space-y-3">
            <h2 className="flex items-center gap-2 pt-3 text-lg font-semibold"><Icon className="h-5 w-5 text-primary" />{type === "college" ? "Colleges" : "Coaching institutes"}<Badge variant="secondary">{list.length}</Badge></h2>
            <div className="space-y-3">{list.map(group => <details key={group.id} className={cn("group rounded-lg border bg-card", group.needsAttention && "border-destructive/50 bg-destructive/5")}>
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
                <Icon className={cn("h-5 w-5 shrink-0", group.needsAttention ? "text-destructive" : "text-primary")} />
                <div className="min-w-0 flex-1"><h3 className={cn("break-words text-sm font-semibold", group.needsAttention && "text-destructive")}>{group.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{group.allItems.length} documents · {4 - group.missing.length}/4 required{isClosedStage(group.current_stage_id, stages) ? " · Closed" : ""}</p>
                </div>
                {group.needsAttention && <Badge variant="outline" className="border-destructive/30 text-destructive"><AlertTriangle className="mr-1 h-3 w-3" />Incomplete</Badge>}
                {group.complete && <CheckCircle2 className="h-5 w-5 text-success" />}
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">{REQUIRED_DOCUMENTS.map(category => {
                  const missing = group.missing.includes(category);
                  const StatusIcon = missing ? (group.needsAttention ? AlertTriangle : Circle) : CheckCircle2;
                  return <span key={category} className={cn("flex items-center gap-1.5 text-xs", missing ? (group.needsAttention ? "text-destructive" : "text-muted-foreground") : "text-success")}><StatusIcon className="h-3.5 w-3.5 shrink-0" />{category}</span>;
                })}</div>
              </summary>
              <div className="space-y-3 border-t p-4">
                {group.missing.length > 0 && <div className="flex flex-wrap gap-2">{group.missing.map(category => <Button key={category} size="sm" variant="outline" className={cn(group.needsAttention && "border-destructive/30 text-destructive")} onClick={() => addRequired(group.id, category)}><Plus className="mr-1 h-3.5 w-3.5" />{category}</Button>)}</div>}
                <ul className="divide-y">{group.files.map(doc => <li key={doc.id} className="flex items-center gap-2 py-3">
                  <FileText className="h-4 w-4 shrink-0 text-primary" /><Button variant="ghost" className="h-auto min-w-0 flex-1 justify-start whitespace-normal px-1 text-left" onClick={() => openDoc(doc.file_path)}><span className="min-w-0 break-words">{doc.name ?? doc.label}<span className="mt-1 block text-xs font-normal text-muted-foreground">{doc.category} · {formatBytes(doc.size_bytes)} · {format(new Date(doc.created_at), "dd MMM yyyy")}</span></span></Button>
                  <Button size="icon" variant="ghost" aria-label={`Open ${doc.name ?? doc.label}`} onClick={() => openDoc(doc.file_path)}><Download className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label={`Delete ${doc.name ?? doc.label}`} onClick={() => { if (window.confirm("Delete this document?")) delDoc.mutate(doc); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </li>)}{group.links.map(link => <li key={link.id} className="flex items-center gap-2 py-3"><LinkIcon className="h-4 w-4 shrink-0 text-primary" /><a className="min-w-0 flex-1 break-words text-sm hover:text-primary" href={link.url} target="_blank" rel="noopener noreferrer">{link.name ?? link.label}<span className="mt-1 block text-xs text-muted-foreground">{link.category}</span></a><ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" /><Button size="icon" variant="ghost" aria-label={`Delete ${link.name ?? link.label}`} onClick={() => { if (window.confirm("Delete this link?")) delLink.mutate(link.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></li>)}</ul>
                {!group.files.length && !group.links.length && <p className="text-sm text-muted-foreground">No documents in this group{categoryFilter !== ANY ? " for this category" : ""}.</p>}
                <Button variant="outline" size="sm" onClick={() => addRequired(group.id, "Others")}><Plus className="mr-1 h-4 w-4" />Other document</Button>
              </div>
            </details>)}</div>
          </section>;
        })}
        {!attentionOnly && (typeFilter === "all" || typeFilter === "general") && (instituteFilter === ANY || instituteFilter === NONE) && <section className="space-y-3 border-t pt-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><FolderOpen className="h-5 w-5 text-primary" />General documents</h2>
          <ul className="divide-y">{filteredDocs.filter(doc => !doc.institute_id).map(doc => <li key={doc.id} className="flex items-center gap-2 py-3"><FileText className="h-4 w-4 shrink-0 text-primary" /><Button variant="ghost" className="h-auto min-w-0 flex-1 justify-start whitespace-normal text-left" onClick={() => openDoc(doc.file_path)}>{doc.name ?? doc.label}</Button><Badge variant="outline">{doc.category}</Badge><Button size="icon" variant="ghost" aria-label={`Delete ${doc.name ?? doc.label}`} onClick={() => { if (window.confirm("Delete this document?")) delDoc.mutate(doc); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></li>)}{filteredLinks.filter(link => !link.institute_id).map(link => <li key={link.id} className="flex items-center gap-2 py-3"><LinkIcon className="h-4 w-4 shrink-0 text-primary" /><a className="min-w-0 flex-1 break-words text-sm" href={link.url} target="_blank" rel="noopener noreferrer">{link.name ?? link.label}</a><Button size="icon" variant="ghost" aria-label={`Delete ${link.name ?? link.label}`} onClick={() => { if (window.confirm("Delete this link?")) delLink.mutate(link.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></li>)}</ul>
          {!filteredDocs.some(doc => !doc.institute_id) && !filteredLinks.some(link => !link.institute_id) && <p className="text-sm text-muted-foreground">No general documents.</p>}
        </section>}
        {!visibleGroups.length && <EmptyState icon={FolderOpen} text="No institutions match your filters." />}
      </>}

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
  head: () => ({ meta: [
    { title: "Documents · Work’s" },
    { name: "description", content: "College and coaching documents, signed MOUs, proposals, welcome letters and payment invoices." },
    { property: "og:title", content: "Institution Documents · Work’s" },
    { property: "og:description", content: "Manage institution records and track missing required documents for closed deals." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => (
    <RequireAuth>
      <AppShell title="Documents">
        <DocumentsPage />
      </AppShell>
    </RequireAuth>
  ),
});
