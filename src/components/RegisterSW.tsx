"use client";

import { useEffect } from "react";

// Registers the service worker on every page load so the installed app keeps a
// fresh cached shell. Rendering nothing — purely a side effect.
export function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
