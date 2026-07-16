import { ReactNode, useState } from "react";
import { Bell, Plus, Sparkles, CheckCheck } from "lucide-react";
import { useNotifications, useMarkAllRead } from "@/lib/me";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow, parseISO } from "date-fns";
import { TaskDialog } from "./TaskDialog";
import { useTaskReminderEngine } from "@/hooks/useTaskReminderEngine";
import { cn } from "@/lib/utils";

export function MeShell({ children, title, subtitle, hideAddTask = false }: { children: ReactNode; title: string; subtitle?: string; hideAddTask?: boolean }) {
  useTaskReminderEngine();
  const [quickOpen, setQuickOpen] = useState(false);

  return (
    <div className="space-y-5 pb-24 sm:pb-5">
      {/* Premium gradient header */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/15 via-card to-primary-glow/10 p-5 shadow-sm sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-primary-glow/20 blur-3xl" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold tracking-tight sm:text-3xl">
              <span className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
                {title}
              </span>
            </h1>
            {subtitle && <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            <BellPopover />
            <Button
              onClick={() => setQuickOpen(true)}
              className="hidden gap-1.5 rounded-xl bg-gradient-to-br from-primary to-primary-glow shadow-md hover:shadow-lg sm:inline-flex"
            >
              <Plus className="h-4 w-4" /> New task
            </Button>
          </div>
        </div>
      </div>

      {children}

      {/* Mobile floating add */}
      <Button
        onClick={() => setQuickOpen(true)}
        size="icon"
        aria-label="New task"
        className="fixed bottom-5 right-5 z-40 h-14 w-14 rounded-full bg-gradient-to-br from-primary to-primary-glow shadow-2xl ring-4 ring-background sm:hidden"
      >
        <Plus className="h-6 w-6" />
      </Button>

      <TaskDialog open={quickOpen} onOpenChange={setQuickOpen} />
    </div>
  );
}

export function BellPopover() {
  const { data = [] } = useNotifications();
  const markAll = useMarkAllRead();
  const unread = data.filter((n) => !n.read_at).length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative rounded-xl border-border/70 bg-background/70 backdrop-blur">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow ring-2 ring-background animate-in zoom-in">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between border-b bg-gradient-to-r from-primary/10 to-transparent px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{unread}</span>
            )}
          </div>
          {unread > 0 && (
            <Button size="sm" variant="ghost" onClick={() => markAll.mutate()} className="h-7 gap-1 text-xs">
              <CheckCheck className="h-3.5 w-3.5" /> Mark all
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          {data.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
              <Sparkles className="h-6 w-6 text-primary/60" />
              You're all caught up.
            </div>
          ) : (
            <ul className="divide-y">
              {data.map((n) => (
                <li key={n.id} className={cn("px-3 py-2.5 text-sm transition-colors hover:bg-muted/50", !n.read_at && "bg-primary/5")}>
                  <div className="flex items-start gap-2">
                    {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-500 ring-2 ring-rose-500/20" />}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-snug">{n.title}</p>
                      {n.body && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</p>}
                      <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                        {formatDistanceToNow(parseISO(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
