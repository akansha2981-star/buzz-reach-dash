import { useMemo, useState, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Plus, Eye, EyeOff, Copy, Edit3, Trash2, ExternalLink,
  FileText, KeyRound, Lock, ShieldCheck, MoreVertical
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  useConfList, useConfSave, useConfDelete, copyToClipboard,
  type ConfDoc, type ConfPassword, type ConfApi,
} from "@/lib/confidential";

type Kind = "documents" | "passwords" | "apis";

export function ConfidentialSection() {
  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-rose-500/10 via-card to-violet-500/10 p-5 shadow-sm">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-rose-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-gradient-to-br from-rose-500 to-violet-600 p-2 text-white shadow">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h2 className="font-display text-2xl font-bold tracking-tight">Confidential</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Your private vault — documents, passwords, and API keys. Visible only to you (row-level secured).
          </p>
        </div>
      </div>

      <Tabs defaultValue="documents" className="w-full">
        <TabsList className="grid w-full grid-cols-3 rounded-xl bg-muted/60 p-1">
          <TabsTrigger value="documents" className="gap-1.5 rounded-lg data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary-glow data-[state=active]:text-primary-foreground">
            <FileText className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Documents</span>
          </TabsTrigger>
          <TabsTrigger value="passwords" className="gap-1.5 rounded-lg data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary-glow data-[state=active]:text-primary-foreground">
            <Lock className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Passwords</span>
          </TabsTrigger>
          <TabsTrigger value="apis" className="gap-1.5 rounded-lg data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary-glow data-[state=active]:text-primary-foreground">
            <KeyRound className="h-3.5 w-3.5" /> <span className="hidden sm:inline">API Keys</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="mt-4"><DocumentsPanel /></TabsContent>
        <TabsContent value="passwords" className="mt-4"><PasswordsPanel /></TabsContent>
        <TabsContent value="apis" className="mt-4"><ApisPanel /></TabsContent>
      </Tabs>
    </section>
  );
}

// ---------- Toolbar ----------
function Toolbar({
  q, setQ, cat, setCat, categories, onAdd, placeholder,
}: {
  q: string; setQ: (v: string) => void;
  cat: string; setCat: (v: string) => void;
  categories: string[]; onAdd: () => void; placeholder: string;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="pl-8" />
      </div>
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setCat("")}
          className={cn(
            "shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all",
            !cat ? "bg-primary text-primary-foreground shadow" : "bg-muted text-muted-foreground hover:bg-muted/70"
          )}
        >All</button>
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cn(
              "shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all",
              cat === c ? "bg-primary text-primary-foreground shadow" : "bg-muted text-muted-foreground hover:bg-muted/70"
            )}
          >{c}</button>
        ))}
      </div>
      <Button onClick={onAdd} className="gap-1.5 bg-gradient-to-br from-primary to-primary-glow">
        <Plus className="h-4 w-4" /> Add
      </Button>
    </div>
  );
}

// ---------- Actions menu ----------
function ItemMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0"><MoreVertical className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}><Edit3 className="mr-2 h-3.5 w-3.5" /> Edit</DropdownMenuItem>
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
          <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EmptyState({ icon: Icon, label, onAdd }: any) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <div className="rounded-full bg-primary/10 p-3"><Icon className="h-6 w-6 text-primary" /></div>
        <p className="font-semibold">Nothing here yet</p>
        <p className="text-xs text-muted-foreground">Add your first {label}.</p>
        <Button size="sm" onClick={onAdd} className="mt-2 gap-1.5"><Plus className="h-4 w-4" /> Add {label}</Button>
      </CardContent>
    </Card>
  );
}

// ---------- Documents ----------
function DocumentsPanel() {
  const { data = [] } = useConfList<ConfDoc>("documents");
  const save = useConfSave("documents");
  const del = useConfDelete("documents");
  const [q, setQ] = useState(""); const [cat, setCat] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; item?: ConfDoc | null }>({ open: false });

  const categories = useMemo(() => Array.from(new Set(data.map((d) => d.category).filter(Boolean) as string[])).sort(), [data]);
  const filtered = useMemo(() =>
    data.filter((d) =>
      (!cat || d.category === cat) &&
      (!q || d.name.toLowerCase().includes(q.toLowerCase()) || (d.link ?? "").toLowerCase().includes(q.toLowerCase()))
    ), [data, q, cat]);

  return (
    <div className="space-y-3">
      <Toolbar q={q} setQ={setQ} cat={cat} setCat={setCat} categories={categories}
        onAdd={() => setDialog({ open: true, item: null })} placeholder="Search documents…" />
      {filtered.length === 0 ? (
        <EmptyState icon={FileText} label="document" onAdd={() => setDialog({ open: true, item: null })} />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <AnimatePresence>
            {filtered.map((d) => (
              <motion.div key={d.id} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Card className="group border-border/60 transition-all hover:border-primary/40">
                  <CardContent className="flex items-center gap-2 p-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-sm">{d.name}</p>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        {d.category && <span className="rounded bg-muted px-1.5 py-0.5">{d.category}</span>}
                        <a href={d.link} target="_blank" rel="noreferrer" className="truncate hover:text-primary">{d.link}</a>
                      </div>
                    </div>
                    <Button asChild size="icon" variant="ghost" className="h-7 w-7">
                      <a href={d.link} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                    </Button>
                    <ItemMenu
                      onEdit={() => setDialog({ open: true, item: d })}
                      onDelete={() => { if (confirm(`Delete "${d.name}"?`)) del.mutate(d.id); }}
                    />
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <DocDialog
        open={dialog.open}
        onOpenChange={(o) => setDialog({ open: o, item: dialog.item })}
        item={dialog.item ?? null}
        onSubmit={async (v) => { await save.mutateAsync(v); setDialog({ open: false }); }}
      />
    </div>
  );
}

function DocDialog({ open, onOpenChange, item, onSubmit }: {
  open: boolean; onOpenChange: (o: boolean) => void; item: ConfDoc | null;
  onSubmit: (v: any) => void | Promise<void>;
}) {
  const [name, setName] = useState(""); const [category, setCategory] = useState("");
  const [link, setLink] = useState(""); const [notes, setNotes] = useState("");
  useMemoInit(open, () => {
    setName(item?.name ?? ""); setCategory(item?.category ?? "");
    setLink(item?.link ?? ""); setNotes(item?.notes ?? "");
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{item ? "Edit document" : "New document"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <FieldRow label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Company OKRs" /></FieldRow>
          <FieldRow label="Category"><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Strategy" /></FieldRow>
          <FieldRow label="Link"><Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" /></FieldRow>
          <FieldRow label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></FieldRow>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!name.trim() || !link.trim()}
            onClick={() => onSubmit({ id: item?.id, name: name.trim(), category: category || null, link: link.trim(), notes: notes || null })}
            className="bg-gradient-to-br from-primary to-primary-glow"
          >{item ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Passwords ----------
function PasswordsPanel() {
  const { data = [] } = useConfList<ConfPassword>("passwords");
  const save = useConfSave("passwords");
  const del = useConfDelete("passwords");
  const [q, setQ] = useState(""); const [cat, setCat] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; item?: ConfPassword | null }>({ open: false });

  const categories = useMemo(() => Array.from(new Set(data.map((d) => d.category).filter(Boolean) as string[])).sort(), [data]);
  const filtered = useMemo(() =>
    data.filter((p) =>
      (!cat || p.category === cat) &&
      (!q || p.name.toLowerCase().includes(q.toLowerCase()) || (p.username ?? "").toLowerCase().includes(q.toLowerCase()))
    ), [data, q, cat]);

  return (
    <div className="space-y-3">
      <Toolbar q={q} setQ={setQ} cat={cat} setCat={setCat} categories={categories}
        onAdd={() => setDialog({ open: true, item: null })} placeholder="Search passwords…" />
      {filtered.length === 0 ? (
        <EmptyState icon={Lock} label="password" onAdd={() => setDialog({ open: true, item: null })} />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <AnimatePresence>
            {filtered.map((p) => (
              <PasswordRow key={p.id} item={p}
                onEdit={() => setDialog({ open: true, item: p })}
                onDelete={() => { if (confirm(`Delete "${p.name}"?`)) del.mutate(p.id); }}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
      <PasswordDialog
        open={dialog.open}
        onOpenChange={(o) => setDialog({ open: o, item: dialog.item })}
        item={dialog.item ?? null}
        onSubmit={async (v) => { await save.mutateAsync(v); setDialog({ open: false }); }}
      />
    </div>
  );
}

function PasswordRow({ item, onEdit, onDelete }: { item: ConfPassword; onEdit: () => void; onDelete: () => void }) {
  const [show, setShow] = useState(false);
  return (
    <motion.div layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <Card className="border-border/60 transition-all hover:border-primary/40">
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Lock className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-sm">{item.name}</p>
              {item.category && <span className="mt-0.5 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px]">{item.category}</span>}
            </div>
            <ItemMenu onEdit={onEdit} onDelete={onDelete} />
          </div>

          {item.username && (
            <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-muted/40 px-2 py-1.5">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">User</span>
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{item.username}</span>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(item.username!, "Username copied")}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          )}

          <div className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-muted/40 px-2 py-1.5">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Pass</span>
            <span className="min-w-0 flex-1 truncate font-mono text-xs">
              {show ? item.password : "•".repeat(Math.min(item.password.length, 12))}
            </span>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setShow((s) => !s)}>
              {show ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(item.password, "Password copied")}>
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function PasswordDialog({ open, onOpenChange, item, onSubmit }: {
  open: boolean; onOpenChange: (o: boolean) => void; item: ConfPassword | null;
  onSubmit: (v: any) => void | Promise<void>;
}) {
  const [name, setName] = useState(""); const [category, setCategory] = useState("");
  const [username, setUsername] = useState(""); const [password, setPassword] = useState("");
  const [url, setUrl] = useState(""); const [notes, setNotes] = useState(""); const [show, setShow] = useState(false);
  useMemoInit(open, () => {
    setName(item?.name ?? ""); setCategory(item?.category ?? "");
    setUsername(item?.username ?? ""); setPassword(item?.password ?? "");
    setUrl(item?.url ?? ""); setNotes(item?.notes ?? ""); setShow(false);
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{item ? "Edit password" : "New password"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <FieldRow label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gmail — work" /></FieldRow>
          <FieldRow label="Category"><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Gmail, Hosting, Social" /></FieldRow>
          <FieldRow label="Username / Email"><Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="you@example.com" /></FieldRow>
          <FieldRow label="Password">
            <div className="relative">
              <Input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="pr-9" />
              <button type="button" onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </FieldRow>
          <FieldRow label="URL"><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></FieldRow>
          <FieldRow label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></FieldRow>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!name.trim() || !password}
            onClick={() => onSubmit({
              id: item?.id, name: name.trim(), category: category || null,
              username: username || null, password, url: url || null, notes: notes || null,
            })}
            className="bg-gradient-to-br from-primary to-primary-glow"
          >{item ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- APIs ----------
function ApisPanel() {
  const { data = [] } = useConfList<ConfApi>("apis");
  const save = useConfSave("apis");
  const del = useConfDelete("apis");
  const [q, setQ] = useState(""); const [cat, setCat] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; item?: ConfApi | null }>({ open: false });

  const categories = useMemo(() => Array.from(new Set(data.map((d) => d.category).filter(Boolean) as string[])).sort(), [data]);
  const filtered = useMemo(() =>
    data.filter((a) =>
      (!cat || a.category === cat) &&
      (!q || a.name.toLowerCase().includes(q.toLowerCase()))
    ), [data, q, cat]);

  return (
    <div className="space-y-3">
      <Toolbar q={q} setQ={setQ} cat={cat} setCat={setCat} categories={categories}
        onAdd={() => setDialog({ open: true, item: null })} placeholder="Search API keys…" />
      {filtered.length === 0 ? (
        <EmptyState icon={KeyRound} label="API key" onAdd={() => setDialog({ open: true, item: null })} />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <AnimatePresence>
            {filtered.map((a) => (
              <ApiRow key={a.id} item={a}
                onEdit={() => setDialog({ open: true, item: a })}
                onDelete={() => { if (confirm(`Delete "${a.name}"?`)) del.mutate(a.id); }}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
      <ApiDialog
        open={dialog.open}
        onOpenChange={(o) => setDialog({ open: o, item: dialog.item })}
        item={dialog.item ?? null}
        onSubmit={async (v) => { await save.mutateAsync(v); setDialog({ open: false }); }}
      />
    </div>
  );
}

function ApiRow({ item, onEdit, onDelete }: { item: ConfApi; onEdit: () => void; onDelete: () => void }) {
  const [show, setShow] = useState(false);
  const masked = "•".repeat(Math.min(item.api_key.length, 20));
  return (
    <motion.div layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <Card className="border-border/60 transition-all hover:border-primary/40">
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <KeyRound className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-sm">{item.name}</p>
              {item.category && <span className="mt-0.5 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px]">{item.category}</span>}
            </div>
            <ItemMenu onEdit={onEdit} onDelete={onDelete} />
          </div>
          <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-muted/40 px-2 py-1.5">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Key</span>
            <span className="min-w-0 flex-1 truncate font-mono text-xs">{show ? item.api_key : masked}</span>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setShow((s) => !s)}>
              {show ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copyToClipboard(item.api_key, "API key copied")}>
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ApiDialog({ open, onOpenChange, item, onSubmit }: {
  open: boolean; onOpenChange: (o: boolean) => void; item: ConfApi | null;
  onSubmit: (v: any) => void | Promise<void>;
}) {
  const [name, setName] = useState(""); const [category, setCategory] = useState("");
  const [apiKey, setApiKey] = useState(""); const [notes, setNotes] = useState(""); const [show, setShow] = useState(false);
  useMemoInit(open, () => {
    setName(item?.name ?? ""); setCategory(item?.category ?? "");
    setApiKey(item?.api_key ?? ""); setNotes(item?.notes ?? ""); setShow(false);
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{item ? "Edit API key" : "New API key"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <FieldRow label="API name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. OpenAI (prod)" /></FieldRow>
          <FieldRow label="Category"><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. AI, Payments, Analytics" /></FieldRow>
          <FieldRow label="API key">
            <div className="relative">
              <Input type={show ? "text" : "password"} value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="pr-9 font-mono" />
              <button type="button" onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </FieldRow>
          <FieldRow label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></FieldRow>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!name.trim() || !apiKey}
            onClick={() => onSubmit({ id: item?.id, name: name.trim(), category: category || null, api_key: apiKey, notes: notes || null })}
            className="bg-gradient-to-br from-primary to-primary-glow"
          >{item ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Small helpers ----------
function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block text-xs">{label}</Label>
      {children}
    </div>
  );
}

// Runs `init` whenever `open` transitions to true. Keeps dialog forms tidy.
function useMemoInit(open: boolean, init: () => void) {
  const [prev, setPrev] = useState(false);
  if (open && !prev) { init(); setPrev(true); }
  if (!open && prev) setPrev(false);
}
