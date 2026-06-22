"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  grossPnl,
  isClosed,
  netFromGross,
  netPnl,
  totalCommissions,
} from "@/lib/calculations";
import { formatMoney, formatNumber, pnlColor } from "@/lib/format";
import { useLiveQuotes } from "@/lib/useLiveQuotes";
import type { Currency, Strategy, Trade } from "@/lib/types";
import { AddTradeForm } from "./AddTradeForm";

type Filter = "open" | "closed";

export function TradesClient({
  trades,
  strategies,
  defaultCommission,
}: {
  trades: Trade[];
  strategies: Strategy[];
  defaultCommission: number;
}) {
  const [filter, setFilter] = useState<Filter>("open");

  const open = useMemo(() => trades.filter((t) => !isClosed(t)), [trades]);
  const closed = useMemo(() => trades.filter(isClosed), [trades]);
  const rows = filter === "open" ? open : closed;

  // Live quotes for the open positions — the P&L column updates in real time.
  const openSymbols = useMemo(() => open.map((t) => t.symbol), [open]);
  const { quotes } = useLiveQuotes(openSymbols);

  const liveNet = (t: Trade): number | null => {
    const price = quotes[t.symbol.toUpperCase()];
    if (price == null) return null;
    const raw = (price - t.entry_price) * t.quantity;
    const gross = t.direction === "long" ? raw : -raw;
    return netFromGross(gross, totalCommissions(t));
  };

  const strategyName = (id: string | null) =>
    id ? strategies.find((s) => s.id === id)?.name ?? "—" : "—";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">עסקאות</h1>
        <AddTradeForm
          strategies={strategies}
          defaultCommission={defaultCommission}
          onAdded={() => setFilter("open")}
        />
      </div>

      <div className="inline-flex bg-surface border border-border rounded-lg p-1 text-sm">
        <button
          onClick={() => setFilter("open")}
          className={`px-3 py-1 rounded-md ${filter === "open" ? "bg-surface-2" : "text-muted"}`}
        >
          פתוחות ({open.length})
        </button>
        <button
          onClick={() => setFilter("closed")}
          className={`px-3 py-1 rounded-md ${filter === "closed" ? "bg-surface-2" : "text-muted"}`}
        >
          סגורות ({closed.length})
        </button>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted text-xs uppercase tracking-wide border-b border-border">
              <th className="text-start font-medium px-4 py-3">סימול</th>
              <th className="text-start font-medium px-4 py-3">כיוון</th>
              <th className="text-start font-medium px-4 py-3">סטאפ</th>
              <th className="text-end font-medium px-4 py-3">כמות</th>
              <th className="text-end font-medium px-4 py-3">כניסה</th>
              <th className="text-end font-medium px-4 py-3">
                {filter === "closed" ? "יציאה" : "תאריך"}
              </th>
              {filter === "closed" ? (
                <>
                  <th className="text-end font-medium px-4 py-3">ברוטו</th>
                  <th className="text-end font-medium px-4 py-3">נטו</th>
                </>
              ) : (
                <>
                  <th className="text-end font-medium px-4 py-3">נטו (חי)</th>
                  <th className="text-end font-medium px-4 py-3" />
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted">
                  אין עסקאות {filter === "open" ? "פתוחות" : "סגורות"} עדיין.
                </td>
              </tr>
            )}
            {rows.map((t) => {
              const ccy = t.native_currency as Currency;
              const gross = grossPnl(t);
              const net = netPnl(t);
              const live = filter === "open" ? liveNet(t) : null;
              return (
                <tr key={t.id} className="border-b border-border/60 hover:bg-surface-2/50">
                  <td className="px-4 py-3">
                    <Link href={`/trades/${t.id}`} className="font-medium hover:text-accent">
                      {t.symbol}
                    </Link>
                    <span className="text-muted text-xs ms-1">{ccy}</span>
                  </td>
                  <td className="px-4 py-3">{t.direction === "long" ? "לונג" : "שורט"}</td>
                  <td className="px-4 py-3 text-muted">{strategyName(t.strategy_id)}</td>
                  <td className="px-4 py-3 text-end tnum">{formatNumber(t.quantity, 0)}</td>
                  <td className="px-4 py-3 text-end tnum">{formatMoney(t.entry_price, ccy)}</td>
                  <td className="px-4 py-3 text-end tnum text-muted">
                    {filter === "closed"
                      ? `${formatMoney(t.exit_price ?? 0, ccy)} · ${t.exit_date}`
                      : t.entry_date}
                  </td>
                  {filter === "closed" ? (
                    <>
                      <td className={`px-4 py-3 text-end tnum ${pnlColor(gross ?? 0)}`}>
                        {gross == null ? "—" : formatMoney(gross, ccy, { signed: true })}
                      </td>
                      <td className={`px-4 py-3 text-end tnum ${pnlColor(net ?? 0)}`}>
                        {net == null ? "—" : formatMoney(net, ccy, { signed: true })}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className={`px-4 py-3 text-end tnum ${pnlColor(live ?? 0)}`}>
                        {live == null ? "—" : formatMoney(live, ccy, { signed: true })}
                      </td>
                      <td className="px-4 py-3 text-end">
                        <Link
                          href={`/trades/${t.id}`}
                          className="text-accent text-xs whitespace-nowrap hover:underline"
                        >
                          סגירה ←
                        </Link>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
