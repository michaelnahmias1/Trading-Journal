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

        {/* Plan vs. actual. */}
        <div className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-sm uppercase tracking-wide text-muted mb-3">תכנון מול ביצוע</h2>
          <Row label="תאריך כניסה" value={trade.entry_date} />
          <Row label="מחיר כניסה" value={formatMoney(trade.entry_price, ccy)} />
          <Row label="כמות" value={formatNumber(trade.quantity, 0)} />
          <Row
            label="סטופ לוס"
            value={trade.stop_loss == null ? "—" : formatMoney(trade.stop_loss, ccy)}
          />
          <Row
            label="מחיר יעד"
            value={trade.target_price == null ? "—" : formatMoney(trade.target_price, ccy)}
          />
          <Row label="סיכון" value={risk == null ? "—" : formatMoney(risk, ccy)} />
          <Row label="מכפיל R" value={r == null ? "—" : `${formatNumber(r, 2)}R`} />
          {closed && (
            <>
              <Row label="תאריך יציאה" value={trade.exit_date ?? "—"} />
              <Row label="מחיר יציאה" value={formatMoney(trade.exit_price ?? 0, ccy)} />
            </>
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
