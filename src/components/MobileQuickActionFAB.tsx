import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, GraduationCap, BookOpen, Calendar, ListChecks, Crown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NewCEORequestDialog } from "@/components/NewCEORequestDialog";
import { NewTaskDialog } from "@/components/NewTaskDialog";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";


export function MobileQuickActionFAB() {
  const [open, setOpen] = useState(false);
  const { isAdmin, perms } = useAuth();
  const can = (k: keyof typeof perms) => isAdmin || perms[k];

  const close = () => setOpen(false);

  const tiles: { to?: string; label: string; icon: typeof Plus; show: boolean; color: string }[] = [
    { to: "/outreach/colleges", label: "Colleges", icon: GraduationCap, show: can("can_colleges"), color: "from-indigo-500 to-blue-500" },
    { to: "/outreach/coaching", label: "Coaching", icon: BookOpen, show: can("can_coaching"), color: "from-fuchsia-500 to-pink-500" },
    { to: "/meetings", label: "Meetings", icon: Calendar, show: can("can_meetings"), color: "from-emerald-500 to-teal-500" },
    { to: "/tasks", label: "Tasks", icon: ListChecks, show: true, color: "from-amber-500 to-orange-500" },
    { to: "/ceo-desk", label: "CEO Desk", icon: Crown, show: true, color: "from-yellow-500 to-amber-600" },
    { to: "/outreach/timeline", label: "Timeline", icon: Search, show: can("can_colleges") || can("can_coaching"), color: "from-sky-500 to-cyan-500" },
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          aria-label="Quick actions"
          className={cn(
            "fixed right-4 z-40 h-14 w-14 rounded-full shadow-lg shadow-primary/30 transition-transform active:scale-95 md:hidden",
            "bottom-[calc(env(safe-area-inset-bottom)+4rem)]"
          )}
        >
          {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl pb-[calc(env(safe-area-inset-bottom)+1rem)]"
      >
        <SheetHeader className="text-left">
          <SheetTitle>Quick actions</SheetTitle>
        </SheetHeader>

        <div className="mt-3 space-y-4">
          {/* Create */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Create</p>
            <div className="grid grid-cols-2 gap-2">
              <NewCEORequestDialog
                trigger={
                  <Button
                    onClick={close}
                    variant="outline"
                    className="h-auto justify-start gap-2 py-3"
                  >
                    <Crown className="h-4 w-4 text-amber-600" />
                    <span className="text-sm">CEO Request</span>
                  </Button>
                }
              />
              <Link to="/outreach/colleges" onClick={close}>
                <Button variant="outline" className="h-auto w-full justify-start gap-2 py-3">
                  <GraduationCap className="h-4 w-4" />
                  <span className="text-sm">Add College</span>
                </Button>
              </Link>
              <Link to="/outreach/coaching" onClick={close}>
                <Button variant="outline" className="h-auto w-full justify-start gap-2 py-3">
                  <BookOpen className="h-4 w-4" />
                  <span className="text-sm">Add Coaching</span>
                </Button>
              </Link>
              <Link to="/meetings" onClick={close}>
                <Button variant="outline" className="h-auto w-full justify-start gap-2 py-3">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm">New Meeting</span>
                </Button>
              </Link>
            </div>
          </div>

          {/* Jump to */}
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Jump to</p>
            <div className="grid grid-cols-3 gap-2">
              {tiles.filter((t) => t.show && t.to).map((t) => {
                const Icon = t.icon;
                return (
                  <Link key={t.to} to={t.to!} onClick={close}>
                    <div
                      className={cn(
                        "flex h-20 flex-col items-center justify-center gap-1 rounded-xl bg-gradient-to-br text-white shadow-sm",
                        t.color
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-[11px] font-medium">{t.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
