"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import {
  grossPnl,
  isClosed,
  netFromGross,
  netPnl,
  totalCommissions,
} from "@/lib/calculations";
import { formatMoney, formatNumber, pnlColor } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { useLiveQuotes } from "@/lib/useLiveQuotes";
import type { Currency, Strategy, Trade } from "@/lib/types";
import { AddTradeForm } from "./AddTradeForm";
import { EditTradeModal } from "./EditTradeModal";

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
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("open");

  // Long-press (mobile) / right-click (desktop) opens an action menu per trade.
  const [menuTrade, setMenuTrade] = useState<Trade | null>(null);
  const [editTrade, setEditTrade] = useState<Trade | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  const open = useMemo(() => trades.filter((t) => !isClosed(t)), [trades]);
  const closed = useMemo(() => trades.filter(isClosed), [trades]);
  const rows = filter === "open" ? open : closed;

  // Live quotes for the open positions — the P&L column updates in real time.
  const openSymbols = useMemo(() => open.map((t) => t.symbol), [open]);
  const { quotes } = useLiveQuotes(openSymbols);

  function startPress(t: Trade) {
    longPressed.current = false;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      setMenuTrade(t);
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(15);
    }, 500);
  }

  function cancelPress() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  }

  async function onDelete(t: Trade) {
    if (!confirm(`למחוק את העסקה ${t.symbol}? פעולה זו אינה הפיכה.`)) return;
    setMenuTrade(null);
    const supabase = createClient();
    const { error } = await supabase.from("trades").delete().eq("id", t.id);
    if (error) {
      alert(`מחיקה נכשלה: ${error.message}`);
      return;
    }
    router.refresh();
  }

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

      <p className="text-muted text-xs">
        טיפ: לחיצה ארוכה על עסקה (או קליק ימני) פותחת אפשרויות עריכה ומחיקה.
      </p>

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
                <tr
                  key={t.id}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenuTrade(t);
                  }}
                  onTouchStart={() => startPress(t)}
                  onTouchEnd={cancelPress}
                  onTouchMove={cancelPress}
                  onTouchCancel={cancelPress}
                  onClickCapture={(e) => {
                    // Swallow the click that would otherwise fire after a long press.
                    if (longPressed.current) {
                      e.preventDefault();
                      e.stopPropagation();
                      longPressed.current = false;
                    }
                  }}
                  className="border-b border-border/60 hover:bg-surface-2/50 select-none"
                >
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

      {/* Long-press / right-click action menu. */}
      {menuTrade && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50"
          onClick={() => setMenuTrade(null)}
        >
          <div
            className="bg-surface border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 text-center text-sm text-muted">
              {menuTrade.symbol} · {menuTrade.direction === "long" ? "לונג" : "שורט"}
            </div>
            <button
              onClick={() => {
                setEditTrade(menuTrade);
                setMenuTrade(null);
              }}
              className="w-full text-start px-4 py-3 rounded-lg hover:bg-surface-2 text-sm"
            >
              ✏️ עריכת עסקה
            </button>
            <button
              onClick={() => onDelete(menuTrade)}
              className="w-full text-start px-4 py-3 rounded-lg hover:bg-surface-2 text-sm text-neg"
            >
              🗑️ מחיקת עסקה
            </button>
            <button
              onClick={() => setMenuTrade(null)}
              className="w-full text-center px-4 py-3 rounded-lg hover:bg-surface-2 text-sm text-muted mt-1"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {editTrade && (
        <EditTradeModal
          trade={editTrade}
          strategies={strategies}
          onClose={() => setEditTrade(null)}
        />
      )}
    </div>
  );
}
