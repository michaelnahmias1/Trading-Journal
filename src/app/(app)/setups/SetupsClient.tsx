"use client";

import { useMemo, useState } from "react";
import { EquityCurveChart } from "@/components/EquityCurveChart";
import { Scoreboard } from "@/components/Scoreboard";
import { TimeframeToggle } from "@/components/TimeframeToggle";
import { computeStats, equityCurve, filterClosedByTimeframe } from "@/lib/calculations";
import { useTimeframe } from "@/lib/useTimeframe";
import type { Strategy, Trade } from "@/lib/types";

const UNASSIGNED = "__unassigned__";

// One setup at a time — the same view as the dashboard, but scoped to a single
// selected setup. Pick which one from the dropdown; everything below recomputes.
export function SetupsClient({
  trades,
  strategies,
}: {
  trades: Trade[];
  strategies: Strategy[];
}) {
  const [timeframe, setTimeframe] = useTimeframe("year");

  // Which setups actually have trades, so the picker only offers real options.
  const hasUnassigned = useMemo(
    () => trades.some((t) => t.strategy_id == null),
    [trades]
  );

  const options = useMemo(() => {
    const opts = strategies.map((s) => ({ value: s.id, label: s.name }));
    if (hasUnassigned) opts.push({ value: UNASSIGNED, label: "ללא שיוך" });
    return opts;
  }, [strategies, hasUnassigned]);

  const [selected, setSelected] = useState<string>(options[0]?.value ?? "");

  const selectedLabel =
    options.find((o) => o.value === selected)?.label ?? "";

  const closed = useMemo(() => {
    const inWindow = filterClosedByTimeframe(trades, timeframe);
    return inWindow.filter((t) =>
      selected === UNASSIGNED ? t.strategy_id == null : t.strategy_id === selected
    );
  }, [trades, timeframe, selected]);

  const stats = useMemo(() => computeStats(closed), [closed]);
  const curve = useMemo(() => equityCurve(closed), [closed]);

  if (options.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">לפי סטאפ</h1>
        <p className="text-muted text-sm">
          עדיין אין סטאפים. אפשר להוסיף אותם במסך ההגדרות, ואז לתייג את העסקאות.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">לפי סטאפ</h1>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="bg-surface-2 border border-border rounded-md px-3 py-1.5 text-sm outline-none focus:border-accent"
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <TimeframeToggle value={timeframe} onChange={setTimeframe} />
      </div>

      <p className="text-muted text-sm">
        כל הנתונים כאן מסוננים לסטאפ <span className="text-text">{selectedLabel}</span> בלבד —
        כך אפשר לראות איפה היתרון ואיפה הדליפה.
      </p>

      <Scoreboard stats={stats} />

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
