"use client";

import { netFromGross, riskAmount, totalCommissions } from "@/lib/calculations";
import { formatMoney, formatNumber, pnlColor } from "@/lib/format";
import { useLiveQuotes } from "@/lib/useLiveQuotes";
import type { Currency, Trade } from "@/lib/types";
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
export function OpenTradePanel({ trade }: { trade: Trade }) {
  const ccy = trade.native_currency as Currency;
  const { quotes, loading } = useLiveQuotes([trade.symbol]);
  const price = quotes[trade.symbol.toUpperCase()] ?? null;

  let gross: number | null = null;
  let net: number | null = null;
  let r: number | null = null;
  if (price != null) {
    const raw = (price - trade.entry_price) * trade.quantity;
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
        <span className={`text-2xl font-semibold tnum ${pnlColor(gross ?? 0)}`}>
          {gross == null ? (loading ? "טוען…" : "—") : formatMoney(gross, ccy, { signed: true })}
        </span>
      </div>

      <div>
        <Row
          label="מחיר נוכחי"
          value={price == null ? "—" : formatMoney(price, ccy)}
        />
        <Row label="מחיר כניסה" value={formatMoney(trade.entry_price, ccy)} />
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
        <p className="text-muted text-sm mb-3">סגירת הפוזיציה — הזן מחיר ותאריך יציאה:</p>
        <CloseTradeForm tradeId={trade.id} />
      </div>
    </div>
  );
}
