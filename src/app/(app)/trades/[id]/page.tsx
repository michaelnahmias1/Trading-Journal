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
import { EditTradeButton } from "./EditTradeButton";
import { OpenTradePanel } from "./OpenTradePanel";

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

  // Planned reward:risk — how much you aimed to make per unit of risk, set BEFORE
  // the trade (target vs. stop). Compare it against the R actually achieved (`r`).
  const plannedRR =
    trade.stop_loss != null && trade.target_price != null
      ? Math.abs(trade.target_price - trade.entry_price) /
        Math.abs(trade.entry_price - trade.stop_loss)
      : null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-muted">
        <Link href="/trades" className="hover:text-text">
          → חזרה לעסקאות
        </Link>
      </div>

      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-semibold">{trade.symbol}</h1>
        <span className="text-muted">{trade.direction === "long" ? "לונג" : "שורט"}</span>
        <span className="text-muted">{ccy}</span>
        <span
          className={`text-xs px-2 py-0.5 rounded-full border ${
            closed ? "border-border text-muted" : "border-accent text-accent"
          }`}
        >
          {closed ? "סגורה" : "פתוחה"}
        </span>
        {setup && <span className="text-muted text-sm">· {setup}</span>}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Result: gross and net side by side. Gross is always visible. */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-sm uppercase tracking-wide text-muted mb-3">תוצאה</h2>
          {closed ? (
            <>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-muted text-sm">רווח/הפסד ברוטו</span>
                <span className={`text-2xl font-semibold tnum ${pnlColor(gross ?? 0)}`}>
                  {formatMoney(gross ?? 0, ccy, { signed: true })}
                </span>
              </div>
              <Row
                label={`עמלות (2 × ${formatMoney(trade.commission_per_side, ccy)})`}
                value={`− ${formatMoney(commissions, ccy)}`}
              />
              <Row
                label="בסיס למס (ברוטו − עמלות)"
                value={formatMoney(base ?? 0, ccy, { signed: true })}
              />
              <Row
                label="הפרשה למס (25% מהבסיס)"
                value={formatMoney((base ?? 0) * 0.25, ccy, { signed: true })}
              />
              <div className="flex items-baseline justify-between mt-3 pt-3 border-t border-border">
                <span className="text-muted text-sm">רווח/הפסד נטו</span>
                <span className={`text-2xl font-semibold tnum ${pnlColor(net ?? 0)}`}>
                  {formatMoney(net ?? 0, ccy, { signed: true })}
                </span>
              </div>
            </>
          ) : (
            <OpenTradePanel trade={trade} />
          )}
        </div>

        {/* Plan vs. actual — the journal's discipline check: what you intended
            (stop, target, planned risk/reward) against what actually happened. */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm uppercase tracking-wide text-muted">תכנון מול ביצוע</h2>
            <EditTradeButton trade={trade} strategies={strategies} />
          </div>

          {/* The plan — set before the trade. */}
          <h3 className="text-xs text-muted mb-1">התכנון</h3>
          <Row
            label="סטופ לוס"
            value={trade.stop_loss == null ? "—" : formatMoney(trade.stop_loss, ccy)}
          />
          <Row
            label="מחיר יעד"
            value={trade.target_price == null ? "—" : formatMoney(trade.target_price, ccy)}
          />
          <Row label="סיכון מתוכנן" value={risk == null ? "—" : formatMoney(risk, ccy)} />
          <Row
            label="יחס סיכון/סיכוי מתוכנן"
            value={plannedRR == null ? "—" : `${formatNumber(plannedRR, 2)}R`}
          />

          {/* The execution — what actually happened. */}
          <h3 className="text-xs text-muted mt-4 mb-1">הביצוע</h3>
          <Row label="כניסה" value={`${formatMoney(trade.entry_price, ccy)} · ${trade.entry_date}`} />
          <Row label="כמות" value={formatNumber(trade.quantity, 0)} />
          {closed ? (
            <>
              <Row
                label="יציאה"
                value={`${formatMoney(trade.exit_price ?? 0, ccy)} · ${trade.exit_date ?? "—"}`}
              />
              <Row
                label="R שהושג בפועל"
                value={r == null ? "—" : `${formatNumber(r, 2)}R`}
                color={r == null ? undefined : pnlColor(r)}
              />
            </>
          ) : (
            <Row label="יציאה" value="— (עסקה פתוחה)" />
          )}

          {(trade.stop_loss == null || trade.target_price == null) && (
            <p className="text-muted text-xs mt-3">
              חסרים שדות תכנון. לחצו על «עריכה» כדי למלא סטופ לוס ומחיר יעד — כך יחושב יחס
              הסיכון/סיכוי וה־R בפועל.
            </p>
          )}
        </div>
      </div>

      {trade.notes && (
        <div className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-sm uppercase tracking-wide text-muted mb-2">הערות</h2>
          <p className="text-sm whitespace-pre-wrap">{trade.notes}</p>
        </div>
      )}
    </div>
  );
}
