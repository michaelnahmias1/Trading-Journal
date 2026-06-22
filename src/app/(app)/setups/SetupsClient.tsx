"use client";

import { useMemo, useState } from "react";
import { Scoreboard } from "@/components/Scoreboard";
import { TimeframeToggle } from "@/components/TimeframeToggle";
import { computeStats, filterClosedByTimeframe, type Stats } from "@/lib/calculations";
import { formatMoney, formatNumber, formatPercent, pnlColor } from "@/lib/format";
import type { Strategy, Timeframe, Trade } from "@/lib/types";

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-border/60 last:border-0 text-sm">
      <span className="text-muted">{label}</span>
      <span className={`tnum ${color ?? ""}`}>{value}</span>
    </div>
  );
}

function SetupCard({ name, stats }: { name: string; stats: Stats }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 min-w-[220px]">
      <h3 className="font-medium mb-3">{name}</h3>
      <MiniStat label="Trades" value={String(stats.totalTrades)} />
      <MiniStat label="Win rate" value={formatPercent(stats.winRate)} />
      <MiniStat label="Avg win" value={formatMoney(stats.averageWin)} color="text-pos" />
      <MiniStat label="Avg loss" value={formatMoney(stats.averageLoss)} color="text-neg" />
      <MiniStat
        label="Avg R"
        value={stats.averageR == null ? "—" : `${formatNumber(stats.averageR, 2)}R`}
      />
      <MiniStat
        label="PF gross"
        value={stats.profitFactorGross == null ? "—" : formatNumber(stats.profitFactorGross, 2)}
      />
      <MiniStat
        label="PF net"
        value={stats.profitFactorNet == null ? "—" : formatNumber(stats.profitFactorNet, 2)}
      />
      <MiniStat
        label="Net P&L"
        value={formatMoney(stats.totalNet, "USD", { signed: true })}
        color={pnlColor(stats.totalNet)}
      />
    </div>
  );
}

// Aggregate is the verdict (primary, full scoreboard). Per-setup blocks are the
// diagnostic — where's the edge, where's the leak — shown side by side.
export function SetupsClient({
  trades,
  strategies,
}: {
  trades: Trade[];
  strategies: Strategy[];
}) {
  const [timeframe, setTimeframe] = useState<Timeframe>("year");

  const closed = useMemo(() => filterClosedByTimeframe(trades, timeframe), [trades, timeframe]);
  const aggregate = useMemo(() => computeStats(closed), [closed]);

  const perSetup = useMemo(() => {
    const named = strategies.map((s) => ({
      name: s.name,
      stats: computeStats(closed.filter((t) => t.strategy_id === s.id)),
    }));
    const unassigned = closed.filter((t) => t.strategy_id == null);
    if (unassigned.length > 0) {
      named.push({ name: "Unassigned", stats: computeStats(unassigned) });
    }
    return named;
  }, [closed, strategies]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Setup breakdown</h1>
        <TimeframeToggle value={timeframe} onChange={setTimeframe} />
      </div>

      <div>
        <h2 className="text-sm uppercase tracking-wide text-muted mb-3">
          Aggregate — the verdict (gross)
        </h2>
        <Scoreboard stats={aggregate} />
      </div>

      <div>
        <h2 className="text-sm uppercase tracking-wide text-muted mb-3">
          Per setup — the diagnostic
        </h2>
        {perSetup.length === 0 ? (
          <p className="text-muted text-sm">
            No setups yet. Add some on the Settings screen, then tag your trades.
          </p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {perSetup.map((s) => (
              <SetupCard key={s.name} name={s.name} stats={s.stats} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
