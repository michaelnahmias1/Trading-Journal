import type { Stats } from "@/lib/calculations";
import { formatMoney, formatNumber, formatPercent, pnlColor } from "@/lib/format";

function Stat({
  label,
  value,
  hint,
  color,
}: {
  label: string;
  value: string;
  hint?: string;
  color?: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="text-muted text-xs uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-semibold tnum mt-1 ${color ?? ""}`}>{value}</div>
      {hint && <div className="text-muted text-xs mt-1">{hint}</div>}
    </div>
  );
}

// The aggregate scoreboard — the verdict. All GROSS except Profit Factor, which
// is shown twice; the gap between the two PFs is the cost of friction.
export function Scoreboard({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      <Stat label="מספר עסקאות" value={String(stats.totalTrades)} />
      <Stat label="אחוז הצלחה" value={formatPercent(stats.winRate)} />
      <Stat
        label="רווח / הפסד ממוצע"
        value={`${formatMoney(stats.averageWin)} / ${formatMoney(stats.averageLoss)}`}
        hint="ברוטו"
      />
      <Stat
        label="R ממוצע"
        value={stats.averageR == null ? "—" : `${formatNumber(stats.averageR, 2)}R`}
        hint="מצטבר"
      />
      <Stat
        label="פקטור רווח (ברוטו)"
        value={stats.profitFactorGross == null ? "—" : formatNumber(stats.profitFactorGross, 2)}
      />
      <Stat
        label="פקטור רווח (נטו)"
        value={stats.profitFactorNet == null ? "—" : formatNumber(stats.profitFactorNet, 2)}
        hint="אחרי עמלות ומס"
      />
      <Stat
        label="רווח/הפסד ברוטו"
        value={formatMoney(stats.totalGross, "USD", { signed: true })}
        color={pnlColor(stats.totalGross)}
      />
      <Stat
        label="רווח/הפסד נטו"
        value={formatMoney(stats.totalNet, "USD", { signed: true })}
        color={pnlColor(stats.totalNet)}
        hint="אחרי עמלות ומס"
      />
    </div>
  );
}
