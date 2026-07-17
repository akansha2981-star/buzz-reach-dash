import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, Trash2, Search, Loader2, FileSpreadsheet, Download, RotateCcw, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchInstitutes, type InstituteType } from "@/lib/data";
import { logAction } from "@/lib/access";
import { toast } from "sonner";

type ParsedRow = { name: string; city?: string; state?: string; website?: string; contact_person?: string; contact_designation?: string; email?: string; phone?: string };

function parseBulk(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return rows;
  // Detect optional header
  const first = lines[0].toLowerCase();
  const hasHeader = /(^|,)\s*name\s*(,|$)/.test(first);
  const headerCols = hasHeader ? lines[0].split(",").map((c) => c.trim().toLowerCase()) : null;
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const keyMap: Record<string, keyof ParsedRow> = {
    name: "name", city: "city", state: "state", website: "website",
    contact: "contact_person", "contact person": "contact_person", "contact_person": "contact_person",
    designation: "contact_designation", "contact_designation": "contact_designation",
    email: "email", phone: "phone", mobile: "phone",
  };
  for (const line of dataLines) {
    const parts = line.split(",").map((c) => c.trim());
    const row: ParsedRow = { name: "" };
    if (headerCols) {
      headerCols.forEach((h, i) => {
        const key = keyMap[h];
        if (key && parts[i]) (row as any)[key] = parts[i];
      });
    } else {
      // Positional: name, city, state, website, contact_person, email, phone
      const [name, city, state, website, contact_person, email, phone] = parts;
      row.name = name;
      if (city) row.city = city;
      if (state) row.state = state;
      if (website) row.website = website;
      if (contact_person) row.contact_person = contact_person;
      if (email) row.email = email;
      if (phone) row.phone = phone;
    }
    if (row.name) rows.push(row);
  }
  return rows;
}

export function BulkAddInstituteDialog({ type }: { type: InstituteType }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { user } = useAuth();
  const parsed = useMemo(() => parseBulk(text), [text]);

  const onPickFile = async (f: File | null) => {
    if (!f) return;
    const okType = /\.(csv|txt|tsv)$/i.test(f.name) || f.type.includes("csv") || f.type.includes("text");
    if (!okType) { toast.error("Please upload a CSV or TXT file"); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error("File too large (max 5MB)"); return; }
    try {
      let content = await f.text();
      // Normalize TSV → CSV
      if (/\t/.test(content) && !/,/.test(content.split(/\r?\n/)[0] ?? "")) {
        content = content.replace(/\t/g, ",");
      }
      setText(content);
      setFileName(f.name);
      toast.success(`Loaded ${f.name}`);
    } catch (e: any) {
      toast.error("Could not read file");
    }
  };

  const downloadTemplate = () => {
    const csv = "name,city,state,website,contact_person,email,phone\nExample Institute,Mumbai,MH,https://example.edu,Rajesh Sharma,contact@example.edu,+91 9876543210\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type === "college" ? "colleges" : "coachings"}-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!parsed.length) throw new Error("Nothing to import");
      const payload = parsed.map((r) => ({
        type, name: r.name,
        city: r.city ?? null, state: r.state ?? null, website: r.website ?? null,
        contact_person: r.contact_person ?? null, contact_designation: r.contact_designation ?? null,
        created_by: user?.id ?? null,
      }));
      const { data: inserted, error } = await supabase.from("institutes").insert(payload).select("id, name");
      if (error) throw error;
      const emails: any[] = []; const phones: any[] = [];
      (inserted ?? []).forEach((inst, i) => {
        const src = parsed[i];
        if (src?.email) emails.push({ institute_id: inst.id, email: src.email });
        if (src?.phone) phones.push({ institute_id: inst.id, phone: src.phone });
      });
      if (emails.length) await supabase.from("institute_emails").insert(emails);
      if (phones.length) await supabase.from("institute_phones").insert(phones);
      await logAction({ action: "institute.bulk_created", entity_type: "institute", details: { type, count: inserted?.length ?? 0 } });
      return inserted?.length ?? 0;
    },
    onSuccess: (n) => {
      toast.success(`Imported ${n} ${type === "college" ? "colleges" : "coaching institutes"}`);
      qc.invalidateQueries({ queryKey: ["institutes", type] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setText(""); setFileName(null); setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5"><Upload className="h-4 w-4" /> Bulk add</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk add {type === "college" ? "colleges" : "coaching institutes"}</DialogTitle>
          <DialogDescription>
            Paste CSV or one per line. First column must be the name. Optional header row supported.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Accepted formats</p>
            <p>• Upload a CSV/TXT file, or paste rows below</p>
            <p>• CSV columns: <code className="text-[11px]">name, city, state, website, contact_person, email, phone</code></p>
            <p>• Header row optional — one name per line also works</p>
          </div>

          {/* CSV file upload */}
          <div
            className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border/70 bg-muted/20 p-4 text-center transition-colors hover:border-primary/50 hover:bg-primary/5 sm:flex-row sm:justify-between sm:text-left"
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={(e) => { e.preventDefault(); onPickFile(e.dataTransfer.files?.[0] ?? null); }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <FileSpreadsheet className="h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {fileName ? fileName : "Drop CSV here or choose a file"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {fileName ? `${parsed.length} rows parsed` : "Max 5MB · .csv / .txt / .tsv"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Template
              </Button>
              <Button type="button" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5">
                <Upload className="h-3.5 w-3.5" /> Choose file
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt,.tsv,text/csv,text/plain"
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          <div>
            <Label>Or paste rows</Label>
            <Textarea
              rows={8}
              className="font-mono text-xs"
              placeholder={"IIT Bombay, Mumbai, MH, https://iitb.ac.in, R. Sharma, contact@iitb.ac.in, +91...\nIIM Ahmedabad, Ahmedabad, GJ"}
              value={text}
              onChange={(e) => { setText(e.target.value); if (fileName) setFileName(null); }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <Badge variant="secondary">{parsed.length} rows ready</Badge>
            {parsed.length > 0 && (
              <span className="text-muted-foreground truncate max-w-[60%]">Preview: {parsed.slice(0, 3).map((r) => r.name).join(", ")}{parsed.length > 3 ? "…" : ""}</span>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!parsed.length || create.isPending} onClick={() => create.mutate()}>
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Import {parsed.length || ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BulkDeleteInstituteDialog({ type }: { type: InstituteType }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const qc = useQueryClient();

  const { data: list = [] } = useQuery({
    queryKey: ["institutes", type],
    queryFn: () => fetchInstitutes(type),
    enabled: open,
  });

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return list;
    return list.filter((i: any) =>
      [i.name, i.city, i.state, i.contact_person].filter(Boolean).some((v: string) => v.toLowerCase().includes(t))
    );
  }, [list, q]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((i: any) => selected.has(i.id));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (allVisibleSelected) filtered.forEach((i: any) => n.delete(i.id));
      else filtered.forEach((i: any) => n.add(i.id));
      return n;
    });
  };

  const del = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      if (!ids.length) throw new Error("Nothing selected");
      await supabase.from("institute_emails").delete().in("institute_id", ids);
      await supabase.from("institute_phones").delete().in("institute_id", ids);
      await supabase.from("outreach_activities").delete().in("institute_id", ids);
      await supabase.from("tasks").delete().in("institute_id", ids);
      await supabase.from("meetings").delete().in("institute_id", ids);
      const { error } = await supabase.from("institutes").delete().in("id", ids);
      if (error) throw error;
      await logAction({ action: "institute.bulk_deleted", entity_type: "institute", details: { type, count: ids.length } });
      return ids.length;
    },
    onSuccess: (n) => {
      toast.success(`Deleted ${n} ${n === 1 ? "profile" : "profiles"}`);
      qc.invalidateQueries({ queryKey: ["institutes", type] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setSelected(new Set()); setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setSelected(new Set()); setQ(""); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /> Bulk delete</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk delete {type === "college" ? "colleges" : "coaching institutes"}</DialogTitle>
          <DialogDescription>Select rows to permanently delete along with their activities, tasks, and meetings.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-2">
              <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} />
              <span className="text-muted-foreground">Select all visible ({filtered.length})</span>
            </label>
            <Badge variant={selected.size ? "destructive" : "secondary"}>{selected.size} selected</Badge>
          </div>
          <ScrollArea className="h-[360px] rounded-md border">
            <ul className="divide-y">
              {filtered.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No matches</li>}
              {filtered.map((i: any) => (
                <li key={i.id} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/40">
                  <Checkbox checked={selected.has(i.id)} onCheckedChange={() => toggle(i.id)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{i.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[i.city, i.state].filter(Boolean).join(", ") || "—"}
                      {i.contact_person ? ` · ${i.contact_person}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={!selected.size || del.isPending}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete {selected.size || ""}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {selected.size} {selected.size === 1 ? "profile" : "profiles"}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes the selected {type === "college" ? "colleges" : "coaching institutes"} along with their activities, tasks and meetings. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => del.mutate()} disabled={del.isPending}>
                  {del.isPending ? "Deleting…" : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
