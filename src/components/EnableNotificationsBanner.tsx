import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notifySupported, requestNotifyPermission, registerSW, showSystemNotification } from "@/lib/push";
import { useAuth } from "@/lib/auth";

export function EnableNotificationsBanner() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!notifySupported()) return;
    registerSW();
    if (Notification.permission === "default" && localStorage.getItem("notif-banner-dismissed") !== "1") setShow(true);
  }, []);

  if (!user || !show) return null;
  return (
    <div className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-md rounded-2xl border bg-card/95 p-3 shadow-xl backdrop-blur md:bottom-4" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2 text-primary"><BellRing className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Turn on task alerts</p>
          <p className="text-xs text-muted-foreground">Get a popup on your phone whenever a task is due.</p>
          <Button
            size="sm"
            className="mt-2 h-8"
            onClick={async () => {
              const r = await requestNotifyPermission();
              setShow(false);
              if (r === "granted") showSystemNotification("Task alerts are on", "You'll be notified when tasks are due.", { tag: "welcome" });
            }}
          >
            Enable notifications
          </Button>
        </div>
        <button aria-label="Dismiss" className="text-muted-foreground" onClick={() => { localStorage.setItem("notif-banner-dismissed", "1"); setShow(false); }}>
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
