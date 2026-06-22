"use client";

import { useEffect, useState } from "react";
import type { QuoteMap } from "./types";

// Client-side market data. Quotes + FX are fetched AFTER first paint (and then
// polled) so navigation is never blocked on an external API — the journal
// renders instantly and prices fill in a beat later, updating in real time.
export function useLiveQuotes(
  symbols: string[],
  { fallbackFx = 3.7, intervalMs = 30_000 }: { fallbackFx?: number; intervalMs?: number } = {}
): { quotes: QuoteMap; fxRate: number; loading: boolean } {
  const [quotes, setQuotes] = useState<QuoteMap>({});
  const [fxRate, setFxRate] = useState(fallbackFx);
  const [loading, setLoading] = useState(symbols.length > 0);

  // Stable, order-independent dependency so we don't refetch on array identity.
  const key = Array.from(new Set(symbols.map((s) => s.toUpperCase())))
    .sort()
    .join(",");

  useEffect(() => {
    let alive = true;

    async function pull() {
      try {
        const [fxRes, qRes] = await Promise.all([
          fetch("/api/fx", { cache: "no-store" }),
          key ? fetch(`/api/quote?symbols=${encodeURIComponent(key)}`, { cache: "no-store" }) : null,
        ]);
        if (!alive) return;
        if (fxRes?.ok) {
          const { usdIls } = await fxRes.json();
          if (alive && typeof usdIls === "number") setFxRate(usdIls);
        }
        if (qRes?.ok) {
          const { quotes: q } = await qRes.json();
          if (alive && q) setQuotes(q as QuoteMap);
        }
      } catch {
        // Best-effort: keep the last known values.
      } finally {
        if (alive) setLoading(false);
      }
    }

    pull();
    const id = setInterval(pull, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [key, intervalMs]);

  return { quotes, fxRate, loading };
}
