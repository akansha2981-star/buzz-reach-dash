import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Pencil, Trash2, Search, Upload, Download, GraduationCap,
  Users, CalendarDays, AlertTriangle, FileSpreadsheet,
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import {
  LMS_YEARS, LMS_CSV_TEMPLATE, type LmsLead, type LeadInput,
  isFullDuplicate, splitDuplicates, parseLeadCsv,
} from "@/lib/lms";

export const Route = createFileRoute("/lms")({
  component: () => (
    <RequireAuth perm="can_lms">
      <AppShell title="LMS Data"><LmsPage /></AppShell>
    </RequireAuth>
  ),
  head: () => ({ meta: [
    { title: "LMS Data | Works" },
    { name: "description", content: "Upload and manage daily LMS lead data by year." },
    { property: "og:title", content: "LMS Data | Works" },
    { property: "og:description", content: "Upload and manage daily LMS lead data by year." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

function LmsPage() {
  const qc = useQueryClient();
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState<LmsLead | null>(null);
  const [deleting, setDeleting] = useState<LmsLead | null>(null);

  const leads = useQuery({
    queryKey: ["lms_leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lms_leads").select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = leads.data ?? [];
  const existing: LeadInput[] = rows.map((r) => ({ name: r.name, phone: r.phone ?? "", email: r.email ?? "" }));

  const perYear = useMemo(() => {
    const map = new Map<number, number>();
    for (const r of rows) map.set(r.year, (map.get(r.year) ?? 0) + 1);
    return map;
  }, [rows]);

  const filtered = rows.filter((r) => {
    if (yearFilter !== "all" && r.year !== Number(yearFilter)) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return r.name.toLowerCase().includes(q) || (r.phone ?? "").includes(q) || (r.email ?? "").toLowerCase().includes(q);
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lms_leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lms_leads"] }); setDeleting(null); toast.success("Entry deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">LMS Data</h1>
          <p className="text-sm text-muted-foreground">Upload daily lead data — name, number, email — tagged by year.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setUploadOpen(true)}><Upload className="mr-1.5 h-4 w-4" />Bulk upload</Button>
          <Button onClick={() => { setEditing(null); setAddOpen(true); }}><Plus className="mr-1.5 h-4 w-4" />Add entry</Button>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-y border-border py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Total entries</p>
            <p className="mt-1 text-2xl font-semibold text-primary">{rows.length}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Showing</p>
            <p className="mt-1 text-2xl font-semibold">{filtered.length}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-full sm:w-40" aria-label="Filter by year"><SelectValue placeholder="All years" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All years</SelectItem>
              {LMS_YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}{perYear.has(y) ? ` (${perYear.get(y)})` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input aria-label="Search entries" placeholder="Search name, number, email…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>
      </div>

      {leads.isLoading ? <p className="py-8 text-center text-muted-foreground">Loading entries…</p>
        : leads.isError ? <div className="space-y-3 py-8 text-center"><p className="text-destructive">Entries could not be loaded.</p><Button variant="outline" onClick={() => leads.refetch()}>Retry</Button></div>
        : filtered.length === 0 ? <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground"><GraduationCap className="h-8 w-8" /><p>{search || yearFilter !== "all" ? "No matching entries." : "No data yet — add an entry or bulk upload a CSV."}</p></div>
        : (
          <div className="divide-y divide-border">
            <div className="hidden grid-cols-[1fr_150px_1fr_90px_150px_88px] gap-4 pb-3 text-xs font-medium text-muted-foreground lg:grid">
              <span>Name</span><span>Number</span><span>Email</span><span>Year</span><span>Added</span><span className="text-right">Actions</span>
            </div>
            {filtered.map((row) => (
              <div key={row.id} className="grid grid-cols-[1fr_auto] items-center gap-2 py-3.5 lg:grid-cols-[1fr_150px_1fr_90px_150px_88px] lg:gap-4">
                <div className="min-w-0 break-words font-medium">{row.name}</div>
                <div className="col-start-1 row-start-2 text-sm text-muted-foreground lg:col-start-2 lg:row-start-1">{row.phone || "—"}</div>
                <div className="col-start-1 row-start-3 min-w-0 break-all text-sm text-muted-foreground lg:col-start-3 lg:row-start-1">{row.email || "—"}</div>
                <div className="col-start-1 row-start-4 lg:col-start-4 lg:row-start-1"><Badge variant="secondary">{row.year}</Badge></div>
                <div className="col-start-1 row-start-5 text-xs text-muted-foreground lg:col-start-5 lg:row-start-1">
                  <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{format(new Date(row.created_at), "dd MMM yyyy")}</span>
                </div>
                <div className="col-start-2 row-start-1 flex justify-end lg:col-start-6">
                  <Button size="icon" variant="ghost" aria-label={`Edit ${row.name}`} title="Edit" onClick={() => { setEditing(row); setAddOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" aria-label={`Delete ${row.name}`} title="Delete" onClick={() => setDeleting(row)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}

      <LeadFormDialog
        open={addOpen}
        onOpenChange={(v) => { setAddOpen(v); if (!v) setEditing(null); }}
        editing={editing}
        existing={existing}
        onSaved={() => qc.invalidateQueries({ queryKey: ["lms_leads"] })}
      />
      <BulkUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        existing={existing}
        onDone={() => qc.invalidateQueries({ queryKey: ["lms_leads"] })}
      />
      <Dialog open={!!deleting} onOpenChange={(v) => { if (!v && !remove.isPending) setDeleting(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete entry?</DialogTitle><DialogDescription>This permanently deletes {deleting?.name} ({deleting?.year}).</DialogDescription></DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={remove.isPending} onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="destructive" disabled={remove.isPending} onClick={() => { if (deleting) remove.mutate(deleting.id); }}>{remove.isPending ? "Deleting…" : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LeadFormDialog({ open, onOpenChange, editing, existing, onSaved }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: LmsLead | null;
  existing: LeadInput[];
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [year, setYear] = useState<string>("");
  const [lastKey, setLastKey] = useState<string | null>(null);

  // Re-seed the form whenever a different entry (or "new") is opened.
  const key = editing?.id ?? "new";
  if (open && key !== lastKey) {
    setLastKey(key);
    setName(editing?.name ?? "");
    setPhone(editing?.phone ?? "");
    setEmail(editing?.email ?? "");
    setYear(editing ? String(editing.year) : "");
  }

  const candidate: LeadInput = { name, phone, email };
  const others = editing ? existing.filter((e) => !(e.name === editing.name && e.phone === (editing.phone ?? "") && e.email === (editing.email ?? ""))) : existing;
  const wouldDuplicate = !editing && isFullDuplicate(candidate, others);

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Enter a name.");
      if (!phone.trim() && !email.trim()) throw new Error("Enter at least a number or an email.");
      if (!year) throw new Error("Select the year this data belongs to.");
      const payload = { name: name.trim(), phone: phone.trim() || null, email: email.trim() || null, year: Number(year) };
      if (editing) {
        const { error } = await supabase.from("lms_leads").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        if (wouldDuplicate) throw new Error("This exact number and email combination already exists — not added.");
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) throw new Error("Please sign in again to save.");
        const { error } = await supabase.from("lms_leads").insert({ ...payload, created_by: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { onSaved(); onOpenChange(false); toast.success(editing ? "Entry updated" : "Entry added"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!save.isPending) onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit entry" : "Add entry"}</DialogTitle>
          <DialogDescription>Name, number, email and the year this data belongs to.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="lms-name">Name</Label>
            <Input id="lms-name" required placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lms-phone">Number</Label>
              <Input id="lms-phone" inputMode="tel" placeholder="9876543210" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lms-email">Email</Label>
              <Input id="lms-email" type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Year</Label>
            <Select value={year || undefined} onValueChange={setYear}>
              <SelectTrigger aria-label="Select year"><SelectValue placeholder="Select year (2020–2029)" /></SelectTrigger>
              <SelectContent>{LMS_YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {wouldDuplicate && (
            <p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              This number and email already exist together — it will not be added again.
            </p>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={save.isPending} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={save.isPending || !name.trim() || !year || wouldDuplicate}>{save.isPending ? "Saving…" : editing ? "Save changes" : "Add entry"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BulkUploadDialog({ open, onOpenChange, existing, onDone }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existing: LeadInput[];
  onDone: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [year, setYear] = useState<string>("");
  const [parsed, setParsed] = useState<LeadInput[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");

  const { fresh, duplicates } = useMemo(() => splitDuplicates(parsed, existing), [parsed, existing]);

  function reset() {
    setParsed([]); setParseErrors([]); setFileName(""); setYear("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    const text = await file.text();
    const { rows, errors } = parseLeadCsv(text);
    setParsed(rows);
    setParseErrors(errors);
  }

  const importRows = useMutation({
    mutationFn: async () => {
      if (!year) throw new Error("Select the year this data belongs to.");
      if (fresh.length === 0) throw new Error("Nothing new to import — every row is a duplicate or invalid.");
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error("Please sign in again to import.");
      const payload = fresh.map((r) => ({
        name: r.name, phone: r.phone || null, email: r.email || null,
        year: Number(year), created_by: user.id,
      }));
      const { error } = await supabase.from("lms_leads").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      onDone();
      toast.success(`Imported ${fresh.length} entries${duplicates.length ? `, skipped ${duplicates.length} duplicates` : ""}`);
      onOpenChange(false);
      reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function downloadTemplate() {
    const blob = new Blob([LMS_CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lms-data-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!importRows.isPending) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk upload data</DialogTitle>
          <DialogDescription>Upload a CSV with columns name, phone, email — then pick the year this batch belongs to.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}><Download className="mr-1.5 h-4 w-4" />CSV template</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}><FileSpreadsheet className="mr-1.5 h-4 w-4" />Choose file</Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              aria-label="Upload CSV file"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
            />
            {fileName && <span className="text-xs text-muted-foreground">{fileName}</span>}
          </div>
          <div className="space-y-1.5">
            <Label>Year for this upload</Label>
            <Select value={year || undefined} onValueChange={setYear}>
              <SelectTrigger aria-label="Select year for upload"><SelectValue placeholder="Select year (2020–2029)" /></SelectTrigger>
              <SelectContent>{LMS_YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {parsed.length > 0 && (
            <div className="space-y-2 rounded-md border border-border p-3 text-sm">
              <p><span className="font-semibold text-primary">{fresh.length}</span> new entries will be imported</p>
              {duplicates.length > 0 && (
                <div>
                  <p className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span className="font-semibold">{duplicates.length}</span> duplicates skipped (same number + email already exist)
                  </p>
                  <ul className="mt-1.5 max-h-28 space-y-0.5 overflow-y-auto text-xs text-muted-foreground">
                    {duplicates.slice(0, 20).map((d, i) => <li key={i}>• {d.name} — {d.phone || d.email}</li>)}
                    {duplicates.length > 20 && <li>…and {duplicates.length - 20} more</li>}
                  </ul>
                </div>
              )}
              {parseErrors.length > 0 && (
                <p className="text-xs text-destructive">{parseErrors.length} lines skipped: {parseErrors.slice(0, 3).join("; ")}{parseErrors.length > 3 ? "…" : ""}</p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={importRows.isPending} onClick={() => { onOpenChange(false); reset(); }}>Cancel</Button>
            <Button type="button" disabled={importRows.isPending || !year || fresh.length === 0} onClick={() => importRows.mutate()}>
              {importRows.isPending ? "Importing…" : `Import ${fresh.length || ""} entries`}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
