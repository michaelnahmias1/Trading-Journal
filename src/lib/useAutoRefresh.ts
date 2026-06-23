"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Keep server-rendered data fresh. Next.js keeps a client-side router cache, so
// navigating between screens (or returning to an installed PWA after a while)
// can show a stale server render — e.g. trades closed a minute ago not yet
// reflected on the dashboard. This refetches the current route on mount and
// whenever the tab/app regains focus, so the numbers are always current.
//
// It re-runs the server component (reliable auth) rather than re-querying from
// the browser, so it can never blank a list the way a client query can.
export function useAutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    router.refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [router]);
}
