"use client";

import { useEffect, useState } from "react";
import type { Timeframe } from "./types";

const KEY = "tj.timeframe";
const VALID: Timeframe[] = ["month", "quarter", "year", "all"];

// Persist the chosen time window across screens and sessions, so moving between
// Dashboard and Setups keeps the same context — like a native app would.
export function useTimeframe(
  initial: Timeframe = "year"
): [Timeframe, (tf: Timeframe) => void] {
  const [timeframe, setTimeframe] = useState<Timeframe>(initial);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY) as Timeframe | null;
      if (saved && VALID.includes(saved)) setTimeframe(saved);
    } catch {
      // ignore — fall back to the initial value
    }
  }, []);

  const set = (tf: Timeframe) => {
    setTimeframe(tf);
    try {
      localStorage.setItem(KEY, tf);
    } catch {
      // ignore
    }
  };

  return [timeframe, set];
}
