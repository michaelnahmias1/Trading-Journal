import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Don't reuse cached RSC payloads for dynamic pages when navigating — every
    // visit re-fetches from the server so trades/dashboard/setups are never
    // stale. Combined with useAutoRefresh this keeps the data live.
    staleTimes: { dynamic: 0, static: 0 },
  },
};

export default nextConfig;
