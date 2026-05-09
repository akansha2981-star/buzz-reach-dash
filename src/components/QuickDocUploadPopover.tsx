import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, Link as LinkIcon, FileUp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { DOC_CATEGORIES, type DocCategory } from "@/lib/document-categories";

const BUCKET = "institute-docs";

export function QuickDocUploadPopover({
  instituteId,
  instituteName,
  trigger,
}: {
  instituteId: string;
  instituteName: string;
  trigger: React.ReactNode;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<DocCategory>("Others");
  const [linkUrl, setLinkUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const reset = () => { setName(""); setLinkUrl(""); setCategory("Others"); };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["institute-docs", instituteId] });
    qc.invalidateQueries({ queryKey: ["institute-links", instituteId] });
    qc.invalidateQueries({ queryKey: ["docs-all"] });
    qc.invalidateQueries({ queryKey: ["links-all"] });
  };

  const addLink = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Name is required");
      if (!linkUrl.trim()) throw new Error("URL is required");
      let url = linkUrl.trim();
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
      const { error } = await supabase.from("institute_links").insert({
        institute_id: instituteId,
        label: name.trim().slice(0, 200),
        name: name.trim().slice(0, 200),
        url: url.slice(0, 2000),
        category,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Link saved to ${instituteName}`);
      reset(); invalidate(); setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function handleFile(file: File) {
    if (!file) return;
    if (!name.trim()) { toast.error("Enter a name first"); return; }
    if (file.size > 25 * 1024 * 1024) { toast.error("Max 25 MB"); return; }
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
        label: name.trim().slice(0, 200),
        name: name.trim().slice(0, 200),
        category,
        file_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
        created_by: user?.id ?? null,
      });
      if (insErr) throw insErr;
      toast.success(`Uploaded to ${instituteName}`);
      reset(); invalidate(); setOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-[calc(100vw-2rem)] max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold">Add document to {instituteName}</p>
            <p className="text-[11px] text-muted-foreground">Quickly upload a file or paste a link.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Name *</Label>
              <Input className="h-8" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} placeholder="e.g. MOU draft" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as DocCategory)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOC_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Tabs defaultValue="file">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="file" className="text-xs"><FileUp className="mr-1 h-3 w-3" /> Upload file</TabsTrigger>
              <TabsTrigger value="link" className="text-xs"><LinkIcon className="mr-1 h-3 w-3" /> Paste link</TabsTrigger>
            </TabsList>
            <TabsContent value="file" className="mt-2">
              <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed bg-background px-3 py-3 text-xs hover:bg-accent">
                <Upload className="h-4 w-4" />
                <span>{uploading ? "Uploading…" : "Choose file (PDF, DOC, image…)"}</span>
                <input
                  type="file"
                  className="hidden"
                  disabled={uploading || !name.trim()}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/*"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
                />
              </label>
              <p className="mt-1 text-[10px] text-muted-foreground">Max 25 MB. Name required.</p>
            </TabsContent>
            <TabsContent value="link" className="mt-2 space-y-2">
              <Input className="h-8" placeholder="https://…" value={linkUrl} maxLength={2000} onChange={(e) => setLinkUrl(e.target.value)} />
              <Button size="sm" className="w-full" disabled={addLink.isPending || !name.trim() || !linkUrl.trim()} onClick={() => addLink.mutate()}>
                Save link
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </PopoverContent>
    </Popover>
  );
}
