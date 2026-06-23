"use client";

import { useMemo, useState } from "react";
import { taxAmount } from "@/lib/calculations";
import { formatMoney } from "@/lib/format";
import type { Trade } from "@/lib/types";

// The rolling tax balance, on its own line — separate from everything else.
// POSITIVE = you owe the state; NEGATIVE = accrued credit consumed by future
// gains. Conceptually resets Jan 1 (the "Year" view shows that balance).
//
// Tapping the line opens a per-trade breakdown (ticker · exit date · amount) so
// it's clear where each charge and credit came from. Only CLOSED trades carry a
// tax effect, so `trades` is expected to be the closed set for the timeframe.
export function TaxLine({ balance, trades }: { balance: number; trades: Trade[] }) {
  const [open, setOpen] = useState(false);
  const owe = balance > 0;
  const credit = balance < 0;

  // Per-trade tax effect (positive = charge/you owe, negative = credit), newest
  // first. Trades without a computable tax effect are dropped.
  const rows = useMemo(
    () =>
      trades
        .map((t) => ({ trade: t, amount: taxAmount(t) }))
        .filter((r): r is { trade: Trade; amount: number } => r.amount != null && r.amount !== 0)
        .sort(
          (a, b) =>
            new Date(b.trade.exit_date ?? 0).getTime() -
            new Date(a.trade.exit_date ?? 0).getTime()
        ),
    [trades]
  );

  const charges = rows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
  const credits = rows.filter((r) => r.amount < 0).reduce((s, r) => s + r.amount, 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-start bg-surface border border-border rounded-xl p-4 flex items-center justify-between hover:bg-surface-2/50 transition-colors"
      >
        <div>
          <div className="text-muted text-xs uppercase tracking-wide">
            מאזן מס <span className="text-accent">›</span>
          </div>
          <div className="text-xs text-muted mt-0.5">
            {owe ? "חבות — מגיע למדינה" : credit ? "זיכוי צבור (מגן מס)" : "מאוזן"} · הקש לפירוט
          </div>
        </div>
        <div
          className={`text-2xl font-semibold tnum ${
            owe ? "text-neg" : credit ? "text-pos" : "text-muted"
          }`}
        >
          {formatMoney(balance, "USD", { signed: true })}
        </div>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-surface border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">פירוט מאזן מס</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted text-sm px-2"
              >
                ✕
              </button>
            </div>

            {rows.length === 0 ? (
              <p className="text-muted text-sm">אין עסקאות סגורות בטווח הנבחר.</p>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted text-xs uppercase tracking-wide border-b border-border">
                      <th className="text-start font-medium py-2">טיקר</th>
                      <th className="text-start font-medium py-2">תאריך</th>
                      <th className="text-end font-medium py-2">סכום</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ trade, amount }) => (
                      <tr key={trade.id} className="border-b border-border/60">
                        <td className="py-2 font-medium">{trade.symbol}</td>
                        <td className="py-2 text-muted">{trade.exit_date ?? "—"}</td>
                        <td
                          className={`py-2 text-end tnum ${
                            amount > 0 ? "text-neg" : "text-pos"
                          }`}
                        >
                          {formatMoney(amount, trade.native_currency, { signed: true })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="space-y-1 pt-2 border-t border-border text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted">סך חיובים</span>
                    <span className="tnum text-neg">{formatMoney(charges, "USD", { signed: true })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">סך זיכויים</span>
                    <span className="tnum text-pos">{formatMoney(credits, "USD", { signed: true })}</span>
                  </div>
                  <div className="flex justify-between font-semibold pt-1">
                    <span>מאזן</span>
                    <span
                      className={`tnum ${owe ? "text-neg" : credit ? "text-pos" : "text-muted"}`}
                    >
                      {formatMoney(balance, "USD", { signed: true })}
                    </span>
                  </div>
                </div>
              </>
            )}

            <p className="text-muted text-xs">
              חיוב = מגיע למדינה (רווח). זיכוי = מגן מס מהפסד. המאזן מתאפס ב־1 בינואר.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
