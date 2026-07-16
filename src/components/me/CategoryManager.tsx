import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, Check, X, Tags, GripVertical } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useMyCategories, useCreateCategory, useUpdateCategory, useDeleteCategory,
  CATEGORY_COLORS, CATEGORY_ICON_KEYS, iconFor, toneStyle, type MeCategory,
} from "@/lib/me-categories";
import { cn } from "@/lib/utils";

export function CategoryManager({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { data: cats = [] } = useMyCategories();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Tags className="mr-1 h-4 w-4" /> Categories
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg overflow-hidden p-0">
        <div className="border-b border-border/60 bg-gradient-to-br from-primary/10 via-background to-background px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Tags className="h-5 w-5 text-primary" /> Manage categories
            </DialogTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Create, rename, recolor, or delete your task categories.
            </p>
          </DialogHeader>
        </div>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto px-6 py-5">
          <NewCategoryForm />
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Your categories ({cats.length})
            </Label>
            <div className="space-y-1.5">
              <AnimatePresence initial={false}>
                {cats.map((c) => (
                  <CategoryRow key={c.id} cat={c} />
                ))}
              </AnimatePresence>
              {cats.length === 0 && (
                <p className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">
                  No categories yet. Add one above.
                </p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewCategoryForm() {
  const [name, setName] = useState("");
  const [color, setColor] = useState(CATEGORY_COLORS[12]);
  const [icon, setIcon] = useState<string>("tag");
  const create = useCreateCategory();

  const submit = async () => {
    if (!name.trim()) return;
    await create.mutateAsync({ name: name.trim(), color, icon });
    setName("");
  };

  const Icon = iconFor(icon);

  return (
    <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
      <Label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Plus className="h-3 w-3" /> New category
      </Label>
      <div className="flex gap-2">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
          style={{ backgroundColor: `${color}22`, borderColor: `${color}55`, color }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="e.g. Content"
          className="h-9 flex-1"
        />
        <Button size="sm" onClick={submit} disabled={!name.trim() || create.isPending}>
          Add
        </Button>
      </div>
      <ColorSwatchRow value={color} onChange={setColor} />
      <IconRow value={icon} onChange={setIcon} color={color} />
    </div>
  );
}

function CategoryRow({ cat }: { cat: MeCategory }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(cat.name);
  const [color, setColor] = useState(cat.color);
  const [icon, setIcon] = useState(cat.icon ?? "tag");
  const update = useUpdateCategory();
  const del = useDeleteCategory();
  const Icon = iconFor(icon);

  const save = async () => {
    await update.mutateAsync({
      id: cat.id,
      previousName: cat.name,
      patch: { name: name.trim() || cat.name, color, icon },
    });
    setEditing(false);
  };

  const cancel = () => {
    setName(cat.name);
    setColor(cat.color);
    setIcon(cat.icon ?? "tag");
    setEditing(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="rounded-xl border border-border/60 bg-card"
    >
      {!editing ? (
        <div className="flex items-center gap-2 p-2.5">
          <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" />
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
            style={toneStyle(cat.color)}
          >
            <Icon className="h-4 w-4" />
          </div>
          <span className="flex-1 truncate text-sm font-medium">{cat.name}</span>
          <span
            className="rounded-md border px-2 py-0.5 text-[10px] font-mono"
            style={toneStyle(cat.color)}
          >
            {cat.color}
          </span>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600 hover:bg-rose-500/10">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete "{cat.name}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tasks using this category will keep their data but lose the label. This can't be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-rose-600 hover:bg-rose-700"
                  onClick={() => del.mutate({ id: cat.id, name: cat.name })}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ) : (
        <div className="space-y-2 p-3">
          <div className="flex gap-2">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
              style={toneStyle(color)}
            >
              <Icon className="h-4 w-4" />
            </div>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
              className="h-9 flex-1"
            />
            <Button size="icon" className="h-9 w-9" onClick={save} disabled={update.isPending}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="outline" className="h-9 w-9" onClick={cancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <ColorSwatchRow value={color} onChange={setColor} />
          <IconRow value={icon} onChange={setIcon} color={color} />
        </div>
      )}
    </motion.div>
  );
}

function ColorSwatchRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {CATEGORY_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={cn(
            "h-6 w-6 rounded-md border-2 transition-transform hover:scale-110",
            value === c ? "border-foreground ring-2 ring-offset-1 ring-offset-background" : "border-transparent"
          )}
          style={{ backgroundColor: c }}
          aria-label={`Color ${c}`}
        />
      ))}
    </div>
  );
}

function IconRow({ value, onChange, color }: { value: string; onChange: (v: string) => void; color: string }) {
  return (
    <div className="flex flex-wrap gap-1">
      {CATEGORY_ICON_KEYS.map((k) => {
        const I = iconFor(k);
        const active = value === k;
        return (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md border transition-all",
              active ? "border-transparent text-white shadow-sm" : "border-border/60 bg-background hover:bg-muted"
            )}
            style={active ? { backgroundColor: color } : undefined}
            aria-label={k}
          >
            <I className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
