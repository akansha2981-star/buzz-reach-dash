import { useEffect, useRef, useState } from "react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity, BarChart3, Gauge, LayoutDashboard, Megaphone, Receipt,
  RefreshCw, Settings as SettingsIcon, Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { inr, SALES_KEYS } from "@/lib/sales";
import { LiveDot, SalesFilterProvider } from "@/components/sales/SalesUI";

export const Route = createFileRoute("/sales")({ component: SalesLayout });

const JUMPS = [
  { id: "sales-overview", label: "Overview", icon: LayoutDashboard },
  { id: "sales-transactions", label: "Transactions", icon: Activity },
  { id: "sales-ad-spend", label: "Ad Spend", icon: Megaphone },
  { id: "sales-profit", label: "Profit", icon: Gauge },
  { id: "sales-reports", label: "Reports", icon: BarChart3 },
  { id: "sales-expenses", label: "Expenses", icon: Receipt },
  { id: "sales-refunds", label: "Refunds", icon: Wallet },
  { id: "sales-settings", label: "Settings", icon: SettingsIcon },
];

function SalesLayout() {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(true);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [active, setActive] = useState<string>(JUMPS[0].id);
  const notified = useRef<Set<string>>(new Set());

  // Highlight the section currently in view in the sticky nav.
  useEffect(() => {
    const onScroll = () => {
      let current = JUMPS[0].id;
      for (const j of JUMPS) {
        const el = document.getElementById(j.id);
        if (el && el.getBoundingClientRect().top <= 160) current = j.id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("sales-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales_payments" }, (payload) => {
        const row = payload.new as { id?: string; final_amount?: number; product_name?: string | null; status?: string } | null;
        qc.invalidateQueries({ queryKey: ["sales"] });
        setLastSync(new Date());
        if (payload.eventType === "INSERT" && row?.id && !notified.current.has(row.id)) {
          notified.current.add(row.id);
          if (row.status !== "failed") {
            toast.success(`New sale · ${inr(row.final_amount ?? 0)}`, {
              description: row.product_name ?? "Payment received",
            });
          }
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "sales_refunds" }, () => {
        qc.invalidateQueries({ queryKey: ["sales"] });
        setLastSync(new Date());
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "sales_ad_spend" }, () => {
        qc.invalidateQueries({ queryKey: ["sales"] });
        setLastSync(new Date());
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "sales_expenses" }, () => {
        qc.invalidateQueries({ queryKey: ["sales"] });
        setLastSync(new Date());
      })
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const retry = () => {
    qc.invalidateQueries({ queryKey: ["sales"] });
    setLastSync(new Date());
    void supabase.realtime.connect();
  };

  return (
    <RequireAuth perm="can_sales_tracker">
      <AppShell title="Live Sales Tracker">
        <SalesFilterProvider>
          <div className="mx-auto w-full max-w-7xl space-y-4">
            <div className="sticky top-0 z-30 -mx-2 space-y-2 border-b border-border/50 bg-background/85 px-2 pb-2 pt-1 backdrop-blur-xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="font-display text-xl font-semibold sm:text-2xl">Live Business Performance</h1>
                    {connected ? <LiveDot /> : (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600">
                        Connection interrupted
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {connected ? "Last updated" : "Last synced"}: {lastSync.toLocaleTimeString()}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={retry}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  {connected ? "Refresh" : "Retry connection"}
                </Button>
              </div>

              <nav className="flex gap-1.5 overflow-x-auto rounded-2xl border border-border/60 bg-background/80 p-1.5 shadow-sm">
                {JUMPS.map((j) => (
                  <a key={j.id} href={`#${j.id}`} className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all",
                    active === j.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}>
                    <j.icon className="h-3.5 w-3.5" /><span>{j.label}</span>
                  </a>
                ))}
              </nav>
            </div>

            <Outlet />
          </div>
        </SalesFilterProvider>
      </AppShell>
    </RequireAuth>
  );
}
