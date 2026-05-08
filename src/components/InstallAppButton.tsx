import { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
}

export function InstallAppButton({ variant = "outline" }: { variant?: "default" | "outline" | "ghost" }) {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) { setInstalled(true); return; }
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as BIPEvent); };
    const onInstalled = () => { setInstalled(true); setEvt(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  const handleClick = async () => {
    if (evt) {
      await evt.prompt();
      await evt.userChoice;
      setEvt(null);
    } else if (isIOS()) {
      setIosHint(true);
    } else {
      setIosHint(true);
    }
  };

  return (
    <>
      <Button size="sm" variant={variant} onClick={handleClick} className="gap-1.5">
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Install app</span>
        <span className="sm:hidden">Install</span>
      </Button>
      {iosHint && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-background/60 p-4 backdrop-blur-sm sm:items-center" onClick={() => setIosHint(false)}>
          <div className="relative w-full max-w-sm rounded-2xl border bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <button className="absolute right-3 top-3 text-muted-foreground hover:text-foreground" onClick={() => setIosHint(false)} aria-label="Close">
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              <h3 className="font-display text-base font-semibold">Install Works on your device</h3>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {isIOS()
                ? "On iPhone/iPad: tap the Share icon in Safari, then choose “Add to Home Screen”."
                : "Open this site in Chrome, Edge, or Brave on Android/Desktop. Tap the browser menu and choose “Install app” or “Add to Home screen”."}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Once installed, Works opens like a native app — full-screen, with quick shortcuts to Dashboard, Meetings, Tasks, Colleges and Coaching.
            </p>
            <Button className="mt-4 w-full" onClick={() => setIosHint(false)}>Got it</Button>
          </div>
        </div>
      )}
    </>
  );
}
