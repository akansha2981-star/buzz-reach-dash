import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Landmark, Star, StarOff, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/accounts/bank-accounts")({ component: BankAccountsPage });

export type BankAccount = {
  id: string;
  tag: string;
  account_holder: string;
  account_number: string;
  ifsc: string | null;
  bank_name: string | null;
  branch: string | null;
  branch_address: string | null;
  upi_id: string | null;
  notes: string | null;
  is_default: boolean;
};

type FormState = Omit<BankAccount, "id">;

const emptyForm: FormState = {
  tag: "", account_holder: "", account_number: "", ifsc: "",
  bank_name: "", branch: "", branch_address: "", upi_id: "",
  notes: "", is_default: false,
};

const TAG_COLORS: Record<string, string> = {
  Primary: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  GST: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  UPI: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30",
  Savings: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  Current: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30",
};

export function tagClass(tag: string) {
  return TAG_COLORS[tag] || "bg-primary/10 text-primary border-primary/30";
}

function BankAccountsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["accounts_bank_accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts_bank_accounts")
        .select("*")
        .order("is_default", { ascending: false })
        .order("tag", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BankAccount[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("accounts_bank_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Account removed");
      qc.invalidateQueries({ queryKey: ["accounts_bank_accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setDefault = useMutation({
    mutationFn: async (id: string) => {
      const { error: e1 } = await supabase.from("accounts_bank_accounts").update({ is_default: false }).neq("id", id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("accounts_bank_accounts").update({ is_default: true }).eq("id", id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Default account updated");
      qc.invalidateQueries({ queryKey: ["accounts_bank_accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Landmark className="h-6 w-6" />Payment Accounts</h1>
          <p className="text-sm text-muted-foreground">Manage the bank / UPI accounts clients pay into. Select one when creating an invoice.</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" />New account</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading…</div>
          ) : accounts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
              <Landmark className="h-8 w-8" />
              <p className="text-sm">No payment accounts yet. Add your first one.</p>
            </div>
          ) : (
            <div className="divide-y">
              {accounts.map((a) => (
                <div key={a.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={tagClass(a.tag)}>{a.tag}</Badge>
                      {a.is_default && (
                        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/30">
                          <Star className="h-3 w-3 mr-1" />Default
                        </Badge>
                      )}
                      <span className="font-medium truncate">{a.account_holder}</span>
                    </div>
                    <div className="mt-1 grid gap-x-4 gap-y-0.5 text-xs text-muted-foreground sm:grid-cols-2">
                      <div className="flex items-center gap-1">
                        <span>A/C: <span className="font-mono text-foreground">{a.account_number}</span></span>
                        <button onClick={() => copy(a.account_number, "Account number")} className="hover:text-foreground"><Copy className="h-3 w-3" /></button>
                      </div>
                      {a.ifsc && (
                        <div className="flex items-center gap-1">
                          <span>IFSC: <span className="font-mono text-foreground">{a.ifsc}</span></span>
                          <button onClick={() => copy(a.ifsc!, "IFSC")} className="hover:text-foreground"><Copy className="h-3 w-3" /></button>
                        </div>
                      )}
                      {a.bank_name && <div>Bank: {a.bank_name}</div>}
                      {a.branch && <div>Branch: {a.branch}</div>}
                      {a.upi_id && (
                        <div className="flex items-center gap-1">
                          <span>UPI: <span className="font-mono text-foreground">{a.upi_id}</span></span>
                          <button onClick={() => copy(a.upi_id!, "UPI")} className="hover:text-foreground"><Copy className="h-3 w-3" /></button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDefault.mutate(a.id)}
                      disabled={a.is_default}
                      title={a.is_default ? "Already default" : "Set as default"}
                    >
                      {a.is_default ? <Star className="h-4 w-4 text-yellow-500" /> : <StarOff className="h-4 w-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(a); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete this account?")) del.mutate(a.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AccountDialog open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  );
}

const TAG_PRESETS = ["Primary", "GST", "UPI", "Savings", "Current"];

function AccountDialog({
  open, onOpenChange, editing,
}: { open: boolean; onOpenChange: (o: boolean) => void; editing: BankAccount | null }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const isEdit = !!editing;

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const { id: _id, ...rest } = editing;
      void _id;
      setForm(rest);
    } else {
      setForm(emptyForm);
    }
  }, [open, editing]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.tag.trim()) throw new Error("Tag is required");
      if (!form.account_holder.trim()) throw new Error("Account holder is required");
      if (!form.account_number.trim()) throw new Error("Account number is required");
      const payload = {
        ...form,
        ifsc: form.ifsc || null, bank_name: form.bank_name || null,
        branch: form.branch || null, branch_address: form.branch_address || null,
        upi_id: form.upi_id || null, notes: form.notes || null,
      };
      if (isEdit) {
        const { error } = await supabase.from("accounts_bank_accounts").update(payload).eq("id", editing!.id);
        if (error) throw error;
      } else {
        const { data: userRes } = await supabase.auth.getUser();
        const { error } = await supabase.from("accounts_bank_accounts").insert({ ...payload, created_by: userRes.user?.id });
        if (error) throw error;
      }
      // Only one default: if this row is default, clear others.
      if (form.is_default) {
        await supabase.from("accounts_bank_accounts").update({ is_default: false })
          .neq("id", editing?.id ?? "00000000-0000-0000-0000-000000000000");
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Account updated" : "Account created");
      qc.invalidateQueries({ queryKey: ["accounts_bank_accounts"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit account" : "New payment account"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Tag *</Label>
            <Input value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} placeholder="e.g. Primary, GST, UPI" />
            <div className="mt-1 flex flex-wrap gap-1">
              {TAG_PRESETS.map((t) => (
                <button key={t} type="button"
                  onClick={() => setForm({ ...form, tag: t })}
                  className={`text-[10px] px-2 py-0.5 rounded border ${tagClass(t)}`}>{t}</button>
              ))}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div><Label>Account holder *</Label><Input value={form.account_holder} onChange={(e) => setForm({ ...form, account_holder: e.target.value })} /></div>
            <div><Label>Account number *</Label><Input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} /></div>
            <div><Label>IFSC</Label><Input value={form.ifsc || ""} onChange={(e) => setForm({ ...form, ifsc: e.target.value })} /></div>
            <div><Label>Bank name</Label><Input value={form.bank_name || ""} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} /></div>
            <div><Label>Branch</Label><Input value={form.branch || ""} onChange={(e) => setForm({ ...form, branch: e.target.value })} /></div>
            <div><Label>UPI ID</Label><Input value={form.upi_id || ""} onChange={(e) => setForm({ ...form, upi_id: e.target.value })} placeholder="name@bank" /></div>
          </div>
          <div><Label>Branch address</Label><Textarea rows={2} value={form.branch_address || ""} onChange={(e) => setForm({ ...form, branch_address: e.target.value })} /></div>
          <div><Label>Notes</Label><Textarea rows={2} value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="flex items-center justify-between rounded-md border p-2">
            <div>
              <Label className="cursor-pointer">Set as default</Label>
              <p className="text-xs text-muted-foreground">Selected automatically for new invoices.</p>
            </div>
            <Switch checked={form.is_default} onCheckedChange={(v) => setForm({ ...form, is_default: v })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
