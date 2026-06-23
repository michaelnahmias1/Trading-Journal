"use client";

import { useEffect, useState } from "react";
import type { QuoteMap } from "./types";

export interface LiveQuotes {
  quotes: QuoteMap;
  /**
   * USD/ILS (ILS per 1 USD). `null` when the live rate is unavailable — we never
   * substitute a fabricated fallback (the old hard-coded 3.7 is gone).
   */
  fxRate: number | null;
  /** Epoch ms when the FX source last published the rate, or null if unknown. */
  fxAsOf: number | null;
  loading: boolean;
  /** The last pull failed at the network / API level. */
  error: boolean;
  /** Requested symbols that currently have no live price (shown as "missing"). */
  missingSymbols: string[];
  /** Epoch ms of the last successful update, or null if none yet. */
  updatedAt: number | null;
}

// Client-side market data. Quotes + FX are fetched AFTER first paint and then
// polled (default every 30s — comfortably inside the 60s freshness target) so
// navigation is never blocked on an external API.
//
// We never invent values: missing prices stay missing and an unavailable FX rate
// stays null, so the UI can say so explicitly instead of showing a made-up number.
export function useLiveQuotes(
  symbols: string[],
  { intervalMs = 30_000 }: { intervalMs?: number } = {}
): LiveQuotes {
  const [quotes, setQuotes] = useState<QuoteMap>({});
  const [fxRate, setFxRate] = useState<number | null>(null);
  const [fxAsOf, setFxAsOf] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [missingSymbols, setMissingSymbols] = useState<string[]>([]);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  // Stable, order-independent dependency so we don't refetch on array identity.
  const key = Array.from(new Set(symbols.map((s) => s.toUpperCase())))
    .sort()
    .join(",");

  useEffect(() => {
    let alive = true;

    async function pull() {
      let anyError = false;
      try {
        const [fxRes, qRes] = await Promise.all([
          fetch("/api/fx", { cache: "no-store" }),
          key ? fetch(`/api/quote?symbols=${encodeURIComponent(key)}`, { cache: "no-store" }) : null,
        ]);
        if (!alive) return;

        // FX — keep last known value on failure, but flag the error so the UI can
        // mark the rate as unavailable rather than silently using a stale number.
        if (fxRes.ok) {
          const { usdIls, asOf } = await fxRes.json();
          if (alive && typeof usdIls === "number") {
            setFxRate(usdIls);
            if (typeof asOf === "number") setFxAsOf(asOf);
          } else anyError = true;
        } else {
          anyError = true;
        }

        // Quotes — the API returns only the symbols it could price; everything
        // else is reported as "missing", never fabricated.
        const want = key ? key.split(",") : [];
        if (qRes) {
          if (qRes.ok) {
            const { quotes: q } = await qRes.json();
            if (alive && q) {
              setQuotes(q as QuoteMap);
              setMissingSymbols(want.filter((s) => (q as QuoteMap)[s] == null));
            }
          } else {
            anyError = true;
            setMissingSymbols(want);
          }
        } else {
          setMissingSymbols([]);
        }

        if (alive) {
          setError(anyError);
          if (!anyError) setUpdatedAt(Date.now());
        }
      } catch {
        if (alive) setError(true);
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

  return { quotes, fxRate, fxAsOf, loading, error, missingSymbols, updatedAt };
}
