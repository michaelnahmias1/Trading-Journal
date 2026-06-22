"use client";

import { useMemo, useState } from "react";
import { EquityCurveChart } from "@/components/EquityCurveChart";
import { PortfolioPanel } from "@/components/PortfolioPanel";
import { Scoreboard } from "@/components/Scoreboard";
import { TaxLine } from "@/components/TaxLine";
import { TimeframeToggle } from "@/components/TimeframeToggle";
import {
  computeStats,
  equityCurve,
  filterClosedByTimeframe,
  isClosed,
  portfolioValue,
  taxBalance,
} from "@/lib/calculations";
import type { Profile, QuoteMap, Timeframe, Trade } from "@/lib/types";

// All numbers derive from one filtered trade set, recomputed reactively when the
// global timeframe changes. Portfolio value is current STATE — timeframe-
// independent; everything else follows the toggle.
export function DashboardClient({
  trades,
  profile,
  quotes,
  fxRate,
  live,
}: {
  trades: Trade[];
  profile: Profile;
  quotes: QuoteMap;
  fxRate: number;
  live: boolean;
}) {
  const [timeframe, setTimeframe] = useState<Timeframe>("year");

  const closedAll = useMemo(() => trades.filter(isClosed), [trades]);
  const openAll = useMemo(() => trades.filter((t) => !isClosed(t)), [trades]);

  const closed = useMemo(
    () => filterClosedByTimeframe(trades, timeframe),
    [trades, timeframe]
  );

  const stats = useMemo(() => computeStats(closed), [closed]);
  const tax = useMemo(() => taxBalance(closed), [closed]);
  const curve = useMemo(() => equityCurve(closed), [closed]);

  const portfolio = useMemo(
    () =>
      portfolioValue({
        initialCapitalUsd: profile.initial_capital_usd,
        initialCapitalIls: profile.initial_capital_ils,
        closedTrades: closedAll,
        openTrades: openAll,
        quotes,
        fxRate,
      }),
    [profile, closedAll, openAll, quotes, fxRate]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <TimeframeToggle value={timeframe} onChange={setTimeframe} />
      </div>

      <PortfolioPanel value={portfolio} fxRate={fxRate} live={live} />

      <TaxLine balance={tax} />

      <div>
        <h2 className="text-sm uppercase tracking-wide text-muted mb-3">Scoreboard (gross)</h2>
        <Scoreboard stats={stats} />
      </div>

      <div className="bg-surface border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm uppercase tracking-wide text-muted">Equity curve</h2>
          <div className="flex items-center gap-4 text-xs text-muted">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 bg-accent" /> Gross
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 bg-pos" /> Net
            </span>
          </div>
        </div>
        <EquityCurveChart data={curve} />
      </div>
    </div>
  );
}
