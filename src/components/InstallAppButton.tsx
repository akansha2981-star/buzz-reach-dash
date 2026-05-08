import { useEffect, useState } from "react";
import { Download, Share, Smartphone, X } from "lucide-react";
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
      try {
        await evt.prompt();
        await evt.userChoice;
        setEvt(null);
      } catch {
        setIosHint(true);
      }
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
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-background/70 p-3 backdrop-blur-sm sm:items-center" onClick={() => setIosHint(false)}>
          <div className="relative w-full max-w-md rounded-2xl border bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <button className="absolute right-3 top-3 text-muted-foreground hover:text-foreground" onClick={() => setIosHint(false)} aria-label="Close">
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              <h3 className="pr-6 font-display text-base font-semibold">Add Works to your Home Screen</h3>
            </div>
            {isIOS() ? (
              <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                <p>iPhone/iPad does not allow websites to open the install popup directly. Install it from Safari:</p>
                <ol className="space-y-2">
                  <li className="flex gap-2"><span className="font-semibold text-foreground">1.</span><span>Open this live site in <span className="font-medium text-foreground">Safari</span>.</span></li>
                  <li className="flex gap-2"><span className="font-semibold text-foreground">2.</span><span>Tap the <Share className="mx-1 inline h-4 w-4" /> Share button at the bottom.</span></li>
                  <li className="flex gap-2"><span className="font-semibold text-foreground">3.</span><span>Choose <span className="font-medium text-foreground">Add to Home Screen</span>, then tap <span className="font-medium text-foreground">Add</span>.</span></li>
                </ol>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Open this site in Chrome, Edge, or Brave, then use the browser menu and choose “Install app” or “Add to Home screen”.
              </p>
            )}
            <Button className="mt-4 w-full" onClick={() => setIosHint(false)}>Got it</Button>
          </div>
        </div>
      )}
    </>
  );
}
