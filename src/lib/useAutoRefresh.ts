"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Keep server-rendered data fresh WITHOUT ever causing a refresh loop.
//
// We deliberately do NOT call router.refresh() on mount. Navigating to any of
// these screens already refetches the server data (every page is
// `dynamic = "force-dynamic"` and the router cache is disabled via
// `staleTimes: { dynamic: 0 }` in next.config.ts), so a mount-time refresh was
// pure redundancy. Worse, it could feed an endless cycle: the refresh re-runs
// the route — which, behind a `loading.tsx` Suspense boundary, can briefly
// unmount and remount this client subtree — and the remount fires the effect
// again, refreshing forever. That is exactly the "the page won't stop
// refreshing on its own" symptom.
//
// Instead we only refetch when the tab/app comes BACK to the foreground after
// being hidden (e.g. returning to an installed PWA after a while), and we
// throttle it so rapid focus/blur flapping on mobile can't hammer the server.
const MIN_INTERVAL_MS = 10_000;

export function useAutoRefresh() {
  const router = useRouter();
  // Seed with "now" so the focus event some browsers fire right after load
  // doesn't trigger an immediate (redundant) refresh on the just-rendered page.
  const lastRefresh = useRef(Date.now());

  useEffect(() => {
    const refresh = () => {
      const now = Date.now();
      if (now - lastRefresh.current < MIN_INTERVAL_MS) return;
      lastRefresh.current = now;
      router.refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [router]);
}
