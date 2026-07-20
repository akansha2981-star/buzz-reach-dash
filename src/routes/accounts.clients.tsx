import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Users, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/accounts/clients")({ component: ClientsPage });

export type AccountsClient = {
  id: string;
  name: string;
  location: string | null;
  email: string | null;
  phone: string | null;
  category: string | null;
  gstin: string | null;
  notes: string | null;
};

type FormState = Omit<AccountsClient, "id">;

const emptyForm = (): FormState => ({
  name: "", location: "", email: "", phone: "", category: "", gstin: "", notes: "",
});

function ClientsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AccountsClient | null>(null);
  const [search, setSearch] = useState("");

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["accounts_clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts_clients")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AccountsClient[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("accounts_clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Client deleted");
      qc.invalidateQueries({ queryKey: ["accounts_clients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const q = search.trim().toLowerCase();
  const filtered = q
    ? clients.filter((c) =>
        [c.name, c.location, c.email, c.phone, c.category, c.gstin]
          .some((v) => (v ?? "").toLowerCase().includes(q)))
    : clients;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Permanent Clients</h1>
          <p className="text-xs text-muted-foreground">Saved client directory — reuse these when creating invoices.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients…" className="pl-8 w-full sm:w-64" />
          </div>
          <Button onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" />Add client
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
              <Users className="h-8 w-8" />
              <p className="text-sm">{clients.length === 0 ? "No saved clients yet." : "No clients match your search."}</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((c) => (
                <div key={c.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium truncate">{c.name}</span>
                      {c.category && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{c.category}</span>}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground space-x-2">
                      {c.location && <span>{c.location}</span>}
                      {c.email && <span>· {c.email}</span>}
                      {c.phone && <span>· {c.phone}</span>}
                      {c.gstin && <span>· GSTIN {c.gstin}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Delete ${c.name}?`)) del.mutate(c.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ClientDialog open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  );
}

function ClientDialog({
  open, onOpenChange, editing,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; editing: AccountsClient | null;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm());
  const isEdit = !!editing;

  // Reset form whenever dialog opens / target changes
  useState(() => form);
  if (open && editing && form.name !== editing.name && form !== (undefined as unknown as FormState)) {
    // no-op; real reset happens below via effect surrogate
  }

  // Simple sync using key-based reset
  const key = open ? (editing?.id ?? "new") : "closed";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit client" : "New client"}</DialogTitle>
        </DialogHeader>
        <ClientForm
          key={key}
          initial={editing ? {
            name: editing.name, location: editing.location ?? "", email: editing.email ?? "",
            phone: editing.phone ?? "", category: editing.category ?? "",
            gstin: editing.gstin ?? "", notes: editing.notes ?? "",
          } : emptyForm()}
          onCancel={() => onOpenChange(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["accounts_clients"] });
            onOpenChange(false);
          }}
          editingId={editing?.id ?? null}
        />
      </DialogContent>
    </Dialog>
  );
}

function ClientForm({
  initial, editingId, onCancel, onSaved,
}: {
  initial: FormState;
  editingId: string | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(initial);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Client name is required");
      const payload = {
        name: form.name.trim(),
        location: form.location || null,
        email: form.email || null,
        phone: form.phone || null,
        category: form.category || null,
        gstin: form.gstin || null,
        notes: form.notes || null,
      };
      if (editingId) {
        const { error } = await supabase.from("accounts_clients").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { data: userRes } = await supabase.auth.getUser();
        const { error } = await supabase.from("accounts_clients").insert({ ...payload, created_by: userRes.user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(editingId ? "Client updated" : "Client added"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <div className="grid gap-3">
        <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ishita Knitfab Pvt Ltd" /></div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div><Label>Location</Label><Input value={form.location ?? ""} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Ludhiana, Punjab" /></div>
          <div><Label>Category</Label><Input value={form.category ?? ""} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Textile" /></div>
          <div><Label>Email</Label><Input value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>Phone</Label><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>GSTIN</Label><Input value={form.gstin ?? ""} onChange={(e) => setForm({ ...form, gstin: e.target.value })} /></div>
        </div>
        <div><Label>Notes</Label><Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
      </div>
      <DialogFooter className="mt-4 gap-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => save.mutate()} disabled={!form.name.trim() || save.isPending}>
          {save.isPending ? "Saving…" : editingId ? "Save changes" : "Add client"}
        </Button>
      </DialogFooter>
    </>
  );
}
