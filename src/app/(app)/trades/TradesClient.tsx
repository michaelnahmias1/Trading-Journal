"use client";

import Link from "next/link";
import { useState } from "react";
import { grossPnl, isClosed, netPnl } from "@/lib/calculations";
import { formatMoney, formatNumber, pnlColor } from "@/lib/format";
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

  const open = trades.filter((t) => !isClosed(t));
  const closed = trades.filter(isClosed);
  const rows = filter === "open" ? open : closed;

  const strategyName = (id: string | null) =>
    id ? strategies.find((s) => s.id === id)?.name ?? "—" : "—";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Trades</h1>
        <AddTradeForm
          strategies={strategies}
          defaultCommission={defaultCommission}
          onAdded={() => setFilter("open")}
        />
      </div>

      <div className="inline-flex bg-surface border border-border rounded-lg p-1 text-sm">
        <button
          onClick={() => setFilter("open")}
          className={`px-3 py-1 rounded-md ${
            filter === "open" ? "bg-surface-2" : "text-muted"
          }`}
        >
          Open ({open.length})
        </button>
        <button
          onClick={() => setFilter("closed")}
          className={`px-3 py-1 rounded-md ${
            filter === "closed" ? "bg-surface-2" : "text-muted"
          }`}
        >
          Closed ({closed.length})
        </button>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted text-xs uppercase tracking-wide border-b border-border">
              <th className="text-left font-medium px-4 py-3">Symbol</th>
              <th className="text-left font-medium px-4 py-3">Dir</th>
              <th className="text-left font-medium px-4 py-3">Setup</th>
              <th className="text-right font-medium px-4 py-3">Qty</th>
              <th className="text-right font-medium px-4 py-3">Entry</th>
              <th className="text-right font-medium px-4 py-3">
                {filter === "closed" ? "Exit" : "Date"}
              </th>
              {filter === "closed" && (
                <>
                  <th className="text-right font-medium px-4 py-3">Gross</th>
                  <th className="text-right font-medium px-4 py-3">Net</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted">
                  No {filter} trades yet.
                </td>
              </tr>
            )}
            {rows.map((t) => {
              const ccy = t.native_currency as Currency;
              const gross = grossPnl(t);
              const net = netPnl(t);
              return (
                <tr key={t.id} className="border-b border-border/60 hover:bg-surface-2/50">
                  <td className="px-4 py-3">
                    <Link href={`/trades/${t.id}`} className="font-medium hover:text-accent">
                      {t.symbol}
                    </Link>
                    <span className="text-muted text-xs ml-1">{ccy}</span>
                  </td>
                  <td className="px-4 py-3 capitalize">{t.direction}</td>
                  <td className="px-4 py-3 text-muted">{strategyName(t.strategy_id)}</td>
                  <td className="px-4 py-3 text-right tnum">{formatNumber(t.quantity, 0)}</td>
                  <td className="px-4 py-3 text-right tnum">
                    {formatMoney(t.entry_price, ccy)}
                  </td>
                  <td className="px-4 py-3 text-right tnum text-muted">
                    {filter === "closed"
                      ? `${formatMoney(t.exit_price ?? 0, ccy)} · ${t.exit_date}`
                      : t.entry_date}
                  </td>
                  {filter === "closed" && (
                    <>
                      <td className={`px-4 py-3 text-right tnum ${pnlColor(gross ?? 0)}`}>
                        {gross == null ? "—" : formatMoney(gross, ccy, { signed: true })}
                      </td>
                      <td className={`px-4 py-3 text-right tnum ${pnlColor(net ?? 0)}`}>
                        {net == null ? "—" : formatMoney(net, ccy, { signed: true })}
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
