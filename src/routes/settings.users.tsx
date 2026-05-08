import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Pencil, Shield, ShieldCheck, ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth";
import { listUsers, createUser, updateUser, deleteUser } from "@/lib/admin-users.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/settings/users")({
  component: () => (
    <RequireAuth perm="can_users">
      <AppShell title="User Management"><UsersPage /></AppShell>
    </RequireAuth>
  ),
});

const PERM_OPTIONS: { key: string; label: string; desc: string }[] = [
  { key: "can_dashboard", label: "Dashboard", desc: "View main dashboard with stats" },
  { key: "can_colleges", label: "Colleges", desc: "Manage college outreach profiles" },
  { key: "can_coaching", label: "Coaching", desc: "Manage coaching outreach profiles" },
  { key: "can_meetings", label: "Meetings", desc: "Schedule and manage meetings" },
  { key: "can_stages", label: "Stage Settings", desc: "Configure outreach pipeline stages" },
  { key: "can_users", label: "User Management", desc: "Create and edit team accounts" },
  { key: "can_logs", label: "Activity Logs", desc: "View full audit trail" },
];

const DEFAULT_PERMS = {
  can_dashboard: true, can_colleges: true, can_coaching: true,
  can_meetings: true, can_stages: false, can_users: false, can_logs: false,
};

function UsersPage() {
  const { isAdmin, loading } = useAuth();
  const fetchList = useServerFn(listUsers);
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchList(),
    enabled: isAdmin,
  });

  if (loading) return null;
  if (!isAdmin) {
    return (
      <Card><CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <Shield className="h-10 w-10 text-muted-foreground" />
        <p className="font-medium">Admin access required</p>
        <Button asChild variant="outline"><Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back to dashboard</Link></Button>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="font-display text-2xl font-bold">Team & Access</h2>
          <p className="text-sm text-muted-foreground">Create accounts and choose exactly which sections each member can use.</p>
        </div>
        <CreateUserDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All accounts</CardTitle>
          <CardDescription>{users.length} {users.length === 1 ? "user" : "users"}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
            <div className="divide-y">
              {users.map((u: any) => <UserRow key={u.id} user={u} />)}
              {users.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No users yet.</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UserRow({ user }: { user: any }) {
  const qc = useQueryClient();
  const del = useServerFn(deleteUser);
  const isAdminUser = user.roles.includes("admin");
  const grantedCount = PERM_OPTIONS.filter((p) => user.permissions[p.key]).length;

  const remove = useMutation({
    mutationFn: () => del({ data: { user_id: user.id } }),
    onSuccess: () => { toast.success("User deleted"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
          {(user.full_name ?? user.email ?? "?").slice(0, 1).toUpperCase()}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium">{user.full_name ?? "—"}{user.designation ? <span className="ml-2 text-xs font-normal text-muted-foreground">· {user.designation}</span> : null}</p>
            {isAdminUser ? (
              <Badge className="gap-1"><ShieldCheck className="h-3 w-3" /> Admin</Badge>
            ) : (
              <Badge variant="secondary">User · {grantedCount}/{PERM_OPTIONS.length} sections</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <EditUserDialog user={user} onSaved={() => qc.invalidateQueries({ queryKey: ["admin-users"] })} />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this user?</AlertDialogTitle>
              <AlertDialogDescription>Permanently removes {user.email} and revokes their access.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => remove.mutate()}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function PermsGrid({ value, onChange, disabled }: { value: any; onChange: (v: any) => void; disabled?: boolean }) {
  return (
    <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
      {PERM_OPTIONS.map((p) => (
        <label key={p.key} className="flex items-start gap-3 rounded-md p-2 hover:bg-accent">
          <Checkbox
            checked={!!value[p.key]} disabled={disabled}
            onCheckedChange={(c) => onChange({ ...value, [p.key]: !!c })}
            className="mt-0.5"
          />
          <div>
            <p className="text-sm font-medium">{p.label}</p>
            <p className="text-xs text-muted-foreground">{p.desc}</p>
          </div>
        </label>
      ))}
    </div>
  );
}

function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", designation: "", role: "user" as "admin" | "user" });
  const [perms, setPerms] = useState<any>(DEFAULT_PERMS);
  const create = useServerFn(createUser);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => create({ data: { ...form, designation: form.designation || null, permissions: perms } }),
    onSuccess: () => {
      toast.success("Account created");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setOpen(false);
      setForm({ email: "", password: "", full_name: "", designation: "", role: "user" });
      setPerms(DEFAULT_PERMS);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New account</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create user account</DialogTitle>
          <DialogDescription>Set credentials and choose which sections they can access.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Full name</Label><Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Password</Label><Input type="text" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" /></div>
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v: any) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User (custom access)</SelectItem>
                  <SelectItem value="admin">Admin (full access)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Section access {form.role === "admin" && <span className="text-xs text-muted-foreground">(admins always have full access)</span>}</Label>
            <PermsGrid value={form.role === "admin" ? Object.fromEntries(PERM_OPTIONS.map((p) => [p.key, true])) : perms} onChange={setPerms} disabled={form.role === "admin"} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={m.isPending}>{m.isPending ? "Creating…" : "Create account"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ user, onSaved }: { user: any; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [full_name, setFullName] = useState(user.full_name ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "user">(user.roles.includes("admin") ? "admin" : "user");
  const [perms, setPerms] = useState<any>(user.permissions);
  const upd = useServerFn(updateUser);
  const m = useMutation({
    mutationFn: () => upd({ data: { user_id: user.id, full_name, role, permissions: perms, ...(password ? { password } : {}) } }),
    onSuccess: () => { toast.success("Updated"); onSaved(); setOpen(false); setPassword(""); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Full name</Label><Input value={full_name} onChange={(e) => setFullName(e.target.value)} /></div>
            <div><Label>New password (leave blank to keep)</Label><Input type="text" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            <div>
              <Label>Role</Label>
              <Select value={role} onValueChange={(v: any) => setRole(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User (custom access)</SelectItem>
                  <SelectItem value="admin">Admin (full access)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Section access</Label>
            <PermsGrid value={role === "admin" ? Object.fromEntries(PERM_OPTIONS.map((p) => [p.key, true])) : perms} onChange={setPerms} disabled={role === "admin"} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={m.isPending}>{m.isPending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
