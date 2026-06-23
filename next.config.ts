import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Give pages a short Router-Cache window so moving between
    // trades/dashboard/setups serves the already-rendered screen INSTANTLY
    // instead of blocking on a server round-trip + DB read every single time
    // (which is what made navigation feel slow). It also lets prefetch fetch the
    // full RSC payload so a tab is ready before it's clicked.
    //
    // We deliberately do NOT pair this with any implicit auto-refresh hook. A
    // mount-time router.refresh() previously caused an uncontrolled reload loop
    // (a refresh behind a loading.tsx Suspense boundary can remount the client
    // subtree, whose remount triggers another refresh). Freshness is handled
    // without that risk: pages are force-dynamic so the first render is always
    // fresh, every mutation calls router.refresh() explicitly, and live P&L
    // streams from the 30s client quote poll. The cache window only bounds how
    // long a re-VISITED tab may reuse its last render — a safe, finite tradeoff.
    staleTimes: { dynamic: 30, static: 180 },
  },
};

export default nextConfig;
