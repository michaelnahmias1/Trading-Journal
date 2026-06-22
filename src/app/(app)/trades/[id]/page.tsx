import Link from "next/link";
import { notFound } from "next/navigation";
import {
  grossPnl,
  isClosed,
  netPnl,
  rMultiple,
  riskAmount,
  taxableBase,
  totalCommissions,
} from "@/lib/calculations";
import { getStrategies, getTrade } from "@/lib/data";
import { formatMoney, formatNumber, pnlColor } from "@/lib/format";
import type { Currency } from "@/lib/types";
import { CloseTradeForm } from "./CloseTradeForm";

export const dynamic = "force-dynamic";

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-border/60 last:border-0">
      <span className="text-muted text-sm">{label}</span>
      <span className={`tnum text-sm ${color ?? ""}`}>{value}</span>
    </div>
  );
}

export default async function TradeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [trade, strategies] = await Promise.all([getTrade(id), getStrategies()]);
  if (!trade) notFound();

  const ccy = trade.native_currency as Currency;
  const closed = isClosed(trade);
  const gross = grossPnl(trade);
  const net = netPnl(trade);
  const base = taxableBase(trade);
  const commissions = totalCommissions(trade);
  const risk = riskAmount(trade);
  const r = rMultiple(trade);
  const setup = trade.strategy_id
    ? strategies.find((s) => s.id === trade.strategy_id)?.name
    : null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-muted">
        <Link href="/trades" className="hover:text-text">
          ← Trades
        </Link>
      </div>

      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-semibold">{trade.symbol}</h1>
        <span className="text-muted capitalize">{trade.direction}</span>
        <span className="text-muted">{ccy}</span>
        <span
          className={`text-xs px-2 py-0.5 rounded-full border ${
            closed ? "border-border text-muted" : "border-accent text-accent"
          }`}
        >
          {closed ? "Closed" : "Open"}
        </span>
        {setup && <span className="text-muted text-sm">· {setup}</span>}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Result: gross and net side by side. Gross is always visible. */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-sm uppercase tracking-wide text-muted mb-3">Result</h2>
          {closed ? (
            <>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-muted text-sm">Gross P&L</span>
                <span className={`text-2xl font-semibold tnum ${pnlColor(gross ?? 0)}`}>
                  {formatMoney(gross ?? 0, ccy, { signed: true })}
                </span>
              </div>
              <Row
                label={`Commissions (2 × ${formatMoney(trade.commission_per_side, ccy)})`}
                value={`− ${formatMoney(commissions, ccy)}`}
              />
              <Row
                label="Taxable base (gross − commissions)"
                value={formatMoney(base ?? 0, ccy, { signed: true })}
              />
              <Row
                label="Tax provision (25% of base)"
                value={formatMoney((base ?? 0) * 0.25, ccy, { signed: true })}
              />
              <div className="flex items-baseline justify-between mt-3 pt-3 border-t border-border">
                <span className="text-muted text-sm">Net P&L</span>
                <span className={`text-2xl font-semibold tnum ${pnlColor(net ?? 0)}`}>
                  {formatMoney(net ?? 0, ccy, { signed: true })}
                </span>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <p className="text-muted text-sm">
                This position is still open. Close it to record the result.
              </p>
              <CloseTradeForm tradeId={trade.id} />
            </div>
          )}
        </div>

        {/* Plan vs. actual. */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-sm uppercase tracking-wide text-muted mb-3">Plan vs. actual</h2>
          <Row label="Entry date" value={trade.entry_date} />
          <Row label="Entry price" value={formatMoney(trade.entry_price, ccy)} />
          <Row label="Quantity" value={formatNumber(trade.quantity, 0)} />
          <Row
            label="Stop loss"
            value={trade.stop_loss == null ? "—" : formatMoney(trade.stop_loss, ccy)}
          />
          <Row
            label="Target price"
            value={trade.target_price == null ? "—" : formatMoney(trade.target_price, ccy)}
          />
          <Row label="Risk" value={risk == null ? "—" : formatMoney(risk, ccy)} />
          <Row
            label="R multiple"
            value={r == null ? "—" : `${formatNumber(r, 2)}R`}
          />
          {closed && (
            <>
              <Row label="Exit date" value={trade.exit_date ?? "—"} />
              <Row label="Exit price" value={formatMoney(trade.exit_price ?? 0, ccy)} />
            </>
          )}
        </div>
      </div>

      {trade.notes && (
        <div className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-sm uppercase tracking-wide text-muted mb-2">Notes</h2>
          <p className="text-sm whitespace-pre-wrap">{trade.notes}</p>
        </div>
      )}
    </div>
  );
}
