"use client";

import {
  closedQuantity,
  netFromGross,
  realizedNetFromCloses,
  remainingQuantity,
  riskAmount,
  totalCommissions,
} from "@/lib/calculations";
import { formatMoney, formatNumber, pnlColor } from "@/lib/format";
import { useLiveQuotes } from "@/lib/useLiveQuotes";
import type { Currency, Trade, TradeClose } from "@/lib/types";
import { CloseTradeForm } from "./CloseTradeForm";

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-border/60 last:border-0">
      <span className="text-muted text-sm">{label}</span>
      <span className={`tnum text-sm ${color ?? ""}`}>{value}</span>
    </div>
  );
}

// Live, unrealized result for an OPEN position. The price streams in from the
// market feed and the P&L recomputes in real time. Closing the trade is right
// here too, so the whole open-position flow lives in one place.
export function OpenTradePanel({ trade, closes }: { trade: Trade; closes: TradeClose[] }) {
  const ccy = trade.native_currency as Currency;
  const { quotes, loading } = useLiveQuotes([trade.symbol]);
  const price = quotes[trade.symbol.toUpperCase()] ?? null;
  // No live price AND we're done loading → genuinely unavailable. We say so
  // explicitly rather than showing a dash that could be mistaken for a value.
  const priceUnavailable = price == null && !loading;

  // Live result is on the REMAINING quantity; partial closes shrink the exposure.
  const remaining = remainingQuantity(trade, closes);
  const closedSoFar = closedQuantity(closes);
  const realizedSoFar = closes.length > 0 ? realizedNetFromCloses(trade, closes) : null;

  let gross: number | null = null;
  let net: number | null = null;
  let r: number | null = null;
  if (price != null) {
    const raw = (price - trade.entry_price) * remaining;
    gross = trade.direction === "long" ? raw : -raw;
    net = netFromGross(gross, totalCommissions(trade));
    const risk = riskAmount(trade);
    if (risk != null) r = gross / risk;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <span className="text-muted text-sm flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
          </span>
          רווח/הפסד חי (לא ממומש)
        </span>
        <span
          className={`text-2xl font-semibold tnum ${
            priceUnavailable ? "text-neg" : pnlColor(gross ?? 0)
          }`}
        >
          {gross == null
            ? loading
              ? "טוען…"
              : "אין נתונים"
            : formatMoney(gross, ccy, { signed: true })}
        </span>
      </div>

      {priceUnavailable && (
        <p className="text-neg text-sm">
          לא ניתן לטעון מחיר חי כעת — לא מוצג ערך משוער. נסה שוב בעוד רגע.
        </p>
      )}

      <div>
        <Row
          label="מחיר נוכחי"
          value={price != null ? formatMoney(price, ccy) : loading ? "טוען…" : "אין נתונים"}
          color={priceUnavailable ? "text-neg" : undefined}
        />
        <Row label="מחיר כניסה" value={formatMoney(trade.entry_price, ccy)} />
        <Row
          label="כמות נותרת"
          value={
            closedSoFar > 0
              ? `${formatNumber(remaining, 0)} מתוך ${formatNumber(trade.quantity, 0)}`
              : formatNumber(remaining, 0)
          }
        />
        {realizedSoFar != null && (
          <Row
            label="מומש עד כה (נטו)"
            value={formatMoney(realizedSoFar, ccy, { signed: true })}
            color={pnlColor(realizedSoFar)}
          />
        )}
        <Row
          label={`עמלות (2 × ${formatMoney(trade.commission_per_side, ccy)})`}
          value={`− ${formatMoney(totalCommissions(trade), ccy)}`}
        />
        <Row label="R נוכחי" value={r == null ? "—" : `${formatNumber(r, 2)}R`} />
        <div className="flex items-baseline justify-between mt-1 pt-2 border-t border-border">
          <span className="text-muted text-sm">נטו אם תסגור עכשיו</span>
          <span className={`text-lg font-semibold tnum ${pnlColor(net ?? 0)}`}>
            {net == null ? "—" : formatMoney(net, ccy, { signed: true })}
          </span>
        </div>
      </div>

      <div className="pt-2 border-t border-border">
        <p className="text-muted text-sm mb-3">
          סגירת הפוזיציה — אפשר לממש חלקית. סגירת כל הכמות הנותרת תסגור את העסקה לפי מחיר יציאה ממוצע משוקלל:
        </p>
        <CloseTradeForm trade={trade} remaining={remaining} />
      </div>
    </div>
  );
}
