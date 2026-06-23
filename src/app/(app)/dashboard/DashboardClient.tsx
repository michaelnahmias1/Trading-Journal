"use client";

import { useMemo } from "react";
import { EquityCurveChart } from "@/components/EquityCurveChart";
import { PortfolioPanel } from "@/components/PortfolioPanel";
import { Scoreboard } from "@/components/Scoreboard";
import { TaxLine } from "@/components/TaxLine";
import { TimeframeToggle } from "@/components/TimeframeToggle";
import { useTimeframe } from "@/lib/useTimeframe";
import { useLiveQuotes } from "@/lib/useLiveQuotes";
import {
  computeStats,
  equityCurve,
  filterClosedByTimeframe,
  isClosed,
  portfolioValue,
  taxBalance,
} from "@/lib/calculations";
import type { Profile, Trade } from "@/lib/types";

// All numbers derive from one filtered trade set, recomputed reactively when the
// global timeframe changes. Portfolio value is current STATE — timeframe-
// independent; everything else follows the toggle. Quotes + FX stream in from
// the client so the screen renders instantly.
export function DashboardClient({
  trades,
  profile,
}: {
  trades: Trade[];
  profile: Profile;
}) {
  const [timeframe, setTimeframe] = useTimeframe("year");

  const closedAll = useMemo(() => trades.filter(isClosed), [trades]);
  const openAll = useMemo(() => trades.filter((t) => !isClosed(t)), [trades]);

  const openSymbols = useMemo(() => openAll.map((t) => t.symbol), [openAll]);
  const { quotes, fxRate, fxAsOf, missingSymbols } = useLiveQuotes(openSymbols);

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
        // nativeUsd / nativeIls don't depend on FX; the converted totals are only
        // shown by PortfolioPanel when a real rate is available (fxRate != null).
        fxRate: fxRate ?? 0,
      }),
    [profile, closedAll, openAll, quotes, fxRate]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">לוח הבקרה</h1>
        <TimeframeToggle value={timeframe} onChange={setTimeframe} />
      </div>

      <PortfolioPanel
        value={portfolio}
        fxRate={fxRate}
        fxAsOf={fxAsOf}
        missingSymbols={missingSymbols}
      />

      <TaxLine balance={tax} trades={closed} />

      <div>
        <h2 className="text-sm uppercase tracking-wide text-muted mb-3">תוצאות (ברוטו)</h2>
        <Scoreboard stats={stats} />
      </div>

      <div className="bg-surface border border-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm uppercase tracking-wide text-muted">עקומת הון</h2>
          <div className="flex items-center gap-4 text-xs text-muted">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 bg-accent" /> ברוטו
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-0.5 bg-pos" /> נטו
            </span>
          </div>
        </div>
        <EquityCurveChart data={curve} />
      </div>
    </div>
  );
}
