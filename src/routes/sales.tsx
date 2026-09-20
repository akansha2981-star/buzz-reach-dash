import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
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

const TABS = [
  { to: "/sales", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/sales/transactions", label: "Live Transactions", icon: Activity },
  { to: "/sales/ad-spend", label: "Ad Spend", icon: Megaphone },
  { to: "/sales/profit", label: "Profit Analytics", icon: Gauge },
  { to: "/sales/reports", label: "Reports", icon: BarChart3 },
  { to: "/sales/expenses", label: "Expenses", icon: Receipt },
  { to: "/sales/refunds", label: "Refunds", icon: Wallet },
  { to: "/sales/settings", label: "Settings", icon: SettingsIcon },
];

function SalesLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();
  const [connected, setConnected] = useState(true);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const notified = useRef<Set<string>>(new Set());

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

            <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-border/60 bg-background/80 p-1 shadow-sm backdrop-blur-md">
              {TABS.map((t) => {
                const active = t.exact ? path === t.to : path.startsWith(t.to);
                return (
                  <Link key={t.to} to={t.to} className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-all",
                    active
                      ? "bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}>
                    <t.icon className="h-4 w-4" /><span>{t.label}</span>
                  </Link>
                );
              })}
            </nav>

            <Outlet />
          </div>
        </SalesFilterProvider>
      </AppShell>
    </RequireAuth>
  );
}

export { SALES_KEYS };
