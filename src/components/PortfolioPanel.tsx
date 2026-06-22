import type { PortfolioValue } from "@/lib/calculations";
import { formatMoney, formatNumber } from "@/lib/format";

// Portfolio value — state, not statistics. Always NET (after a 25% tax
// provision, applied to unrealized gains too). Shown in BOTH currencies; the two
// figures breathe with FX in opposite directions.
export function PortfolioPanel({
  value,
  fxRate,
  live,
}: {
  value: PortfolioValue;
  fxRate: number;
  live: boolean;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm uppercase tracking-wide text-muted">Portfolio value (net)</h2>
        <span className="text-xs text-muted">
          USD/ILS {formatNumber(fxRate, 3)} {live ? "" : "· mock"}
        </span>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
        <div>
          <div className="text-3xl font-semibold tnum">{formatMoney(value.usd, "USD")}</div>
          <div className="text-muted text-xs mt-0.5">USD view</div>
        </div>
        <div>
          <div className="text-3xl font-semibold tnum">{formatMoney(value.ils, "ILS")}</div>
          <div className="text-muted text-xs mt-0.5">ILS view</div>
        </div>
      </div>
      <p className="text-muted text-xs mt-3">
        What&apos;s left if you liquidate right now. The gap between the two views is currency, not
        trading.
      </p>
    </div>
  );
}
