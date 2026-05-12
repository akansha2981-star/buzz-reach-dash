import { ReactNode, useState } from "react";
import { Bell, Plus, Sparkles } from "lucide-react";
import { useNotifications, useMarkAllRead } from "@/lib/me";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow, parseISO } from "date-fns";
import { TaskDialog } from "./TaskDialog";
import { useTaskReminderEngine } from "@/hooks/useTaskReminderEngine";

export function MeShell({ children, title, subtitle }: { children: ReactNode; title: string; subtitle?: string }) {
  useTaskReminderEngine();
  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          <BellPopover />
          <QuickAddButton />
        </div>
      </header>
      {children}
    </div>
  );
}

function QuickAddButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-1.5 shadow-sm">
        <Plus className="h-4 w-4" /> Quick add
      </Button>
      <TaskDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function BellPopover() {
  const { data = [] } = useNotifications();
  const markAll = useMarkAllRead();
  const unread = data.filter((n) => !n.read_at).length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow ring-2 ring-background">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && (
            <Button size="sm" variant="ghost" onClick={() => markAll.mutate()} className="h-7 text-xs">
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          {data.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
              <Sparkles className="h-6 w-6" />
              You're all caught up.
            </div>
          ) : (
            <ul className="divide-y">
              {data.map((n) => (
                <li key={n.id} className={`px-3 py-2 text-sm ${!n.read_at ? "bg-primary/5" : ""}`}>
                  <div className="flex items-start gap-2">
                    {!n.read_at && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" />}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{n.title}</p>
                      {n.body && <p className="text-xs text-muted-foreground truncate">{n.body}</p>}
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{formatDistanceToNow(parseISO(n.created_at), { addSuffix: true })}</p>
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
