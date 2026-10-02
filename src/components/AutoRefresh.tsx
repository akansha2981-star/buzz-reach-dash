import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

const INTERVAL = 10 * 60 * 1000;

/** Refreshes all data every 10 min and whenever the app is reopened (e.g. from a home-screen bookmark). */
export function AutoRefresh() {
  const qc = useQueryClient();
  const last = useRef(Date.now());

  useEffect(() => {
    const refresh = () => {
      last.current = Date.now();
      qc.invalidateQueries();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) refresh(); };
    const id = window.setInterval(refresh, INTERVAL);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("focus", onVisible);
    };
  }, [qc]);

  return null;
}
