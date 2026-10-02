import { toast } from "sonner";

export function notifySupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function registerSW() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try { return await navigator.serviceWorker.register("/sw.js"); } catch { return null; }
}

export async function requestNotifyPermission() {
  if (!notifySupported()) return "unsupported" as const;
  await registerSW();
  try { return await Notification.requestPermission(); } catch { return Notification.permission; }
}

/** Shows a system notification popup (works on Android/iOS home-screen app via service worker) plus an in-app toast. */
export async function showSystemNotification(title: string, body?: string | null, opts: { tag?: string; url?: string } = {}) {
  toast(title, { description: body ?? undefined, duration: 8000 });
  if (!notifySupported() || Notification.permission !== "granted") return;
  const options: NotificationOptions & Record<string, any> = {
    body: body ?? undefined,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: opts.tag,
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: { url: opts.url ?? "/me" },
  };
  try {
    const reg = (await navigator.serviceWorker?.getRegistration()) ?? (await registerSW());
    if (reg) { await reg.showNotification(title, options); return; }
  } catch { /* fall through */ }
  try { new Notification(title, options); } catch { /* ignore */ }
}
