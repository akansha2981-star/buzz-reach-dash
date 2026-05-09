import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link as LinkIcon, FileText, Upload, Trash2, Plus, ExternalLink, Download } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRealtime } from "@/hooks/useRealtime";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DOC_CATEGORIES, CATEGORY_COLORS, type DocCategory } from "@/lib/document-categories";

const BUCKET = "institute-docs";

function formatBytes(b?: number | null) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function InstituteResources({ instituteId }: { instituteId: string }) {
  useRealtime("institute_links", [["institute-links", instituteId]]);
  useRealtime("institute_documents", [["institute-docs", instituteId]]);
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: links = [] } = useQuery({
    queryKey: ["institute-links", instituteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("institute_links").select("*").eq("institute_id", instituteId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: docs = [] } = useQuery({
    queryKey: ["institute-docs", instituteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("institute_documents").select("*").eq("institute_id", instituteId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Links
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkCategory, setLinkCategory] = useState<DocCategory>("Others");
  const addLink = useMutation({
    mutationFn: async () => {
      if (!linkLabel.trim() || !linkUrl.trim()) throw new Error("Label and URL required");
      let url = linkUrl.trim();
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
      const { error } = await supabase.from("institute_links").insert({
        institute_id: instituteId,
        label: linkLabel.trim().slice(0, 200),
        name: linkLabel.trim().slice(0, 200),
        url: url.slice(0, 2000),
        category: linkCategory,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Link added");
      setLinkLabel(""); setLinkUrl(""); setLinkCategory("Others");
      qc.invalidateQueries({ queryKey: ["institute-links", instituteId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delLink = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("institute_links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["institute-links", instituteId] }),
  });

  // Docs
  const [docLabel, setDocLabel] = useState("");
  const [docCategory, setDocCategory] = useState<DocCategory>("Others");
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Max file size is 25 MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${instituteId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || undefined,
      });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("institute_documents").insert({
        institute_id: instituteId,
        label: (docLabel.trim() || file.name).slice(0, 200),
        file_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
        created_by: user?.id ?? null,
      });
      if (insErr) throw insErr;
      toast.success("Document uploaded");
      setDocLabel("");
      qc.invalidateQueries({ queryKey: ["institute-docs", instituteId] });
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
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["institute-docs", instituteId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Links */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <LinkIcon className="h-4 w-4 text-primary" /> Important Links
            <Badge variant="outline" className="ml-auto">{links.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Label</Label>
                <Input placeholder="e.g. Brochure" value={linkLabel} maxLength={200} onChange={(e) => setLinkLabel(e.target.value)} />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">URL</Label>
                <Input placeholder="https://…" value={linkUrl} maxLength={2000} onChange={(e) => setLinkUrl(e.target.value)} />
              </div>
            </div>
            <Button size="sm" className="w-full" disabled={addLink.isPending || !linkLabel.trim() || !linkUrl.trim()} onClick={() => addLink.mutate()}>
              <Plus className="mr-1 h-4 w-4" /> Add link
            </Button>
          </div>
          {links.length === 0 ? (
            <p className="py-2 text-center text-sm text-muted-foreground">No links yet.</p>
          ) : (
            <ul className="space-y-2">
              {links.map((l: any) => (
                <li key={l.id} className="group flex items-center gap-2 rounded-md border bg-card p-2">
                  <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <a href={l.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary">
                    {l.label}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">{l.url}</span>
                  </a>
                  <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => delLink.mutate(l.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Documents */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" /> Documents & PDFs
            <Badge variant="outline" className="ml-auto">{docs.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <div>
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Label (optional)</Label>
              <Input placeholder="e.g. MoU draft v2" value={docLabel} maxLength={200} onChange={(e) => setDocLabel(e.target.value)} />
            </div>
            <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed bg-background px-3 py-3 text-sm hover:bg-accent">
              <Upload className="h-4 w-4" />
              <span>{uploading ? "Uploading…" : "Choose file (PDF, DOC, image…)"}</span>
              <input
                type="file"
                className="hidden"
                disabled={uploading}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/*"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
              />
            </label>
            <p className="text-[11px] text-muted-foreground">Max 25 MB per file.</p>
          </div>
          {docs.length === 0 ? (
            <p className="py-2 text-center text-sm text-muted-foreground">No documents uploaded.</p>
          ) : (
            <ul className="space-y-2">
              {docs.map((d: any) => (
                <li key={d.id} className="group flex items-center gap-2 rounded-md border bg-card p-2">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <button onClick={() => openDoc(d.file_path)} className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:text-primary">
                    {d.label}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {formatBytes(d.size_bytes)} · {format(new Date(d.created_at), "MMM d")}
                    </span>
                  </button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openDoc(d.file_path)} title="Download">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => delDoc.mutate(d)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
