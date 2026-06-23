"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  grossPnl,
  isClosed,
  netFromGross,
  netPnl,
  percentReturn,
  positionSize,
  totalCommissions,
} from "@/lib/calculations";
import { formatMoney, formatNumber, formatPercent, pnlColor } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { useLiveQuotes } from "@/lib/useLiveQuotes";
import type { Currency, Strategy, Trade } from "@/lib/types";
import { AddTradeForm } from "./AddTradeForm";
import { EditTradeModal } from "./EditTradeModal";

type Filter = "open" | "closed";

export function TradesClient({
  trades: initialTrades,
  strategies,
  defaultCommission,
}: {
  trades: Trade[];
  strategies: Strategy[];
  defaultCommission: number;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("open");

  // The list is seeded from the server (where auth + RLS are reliable) and then
  // updated OPTIMISTICALLY on each mutation, so trades land in the right bucket
  // instantly instead of waiting on a full server round-trip — which is what
  // caused the lag and the "rows flicker / vanish until refresh" feeling.
  //
  // We deliberately do NOT re-query from the browser on mount: that could return
  // an empty set before the client session is ready and blank out the list.
  // Reconciliation goes through the server (router.refresh) instead.
  const [trades, setTrades] = useState<Trade[]>(initialTrades);

  // Adopt the authoritative list whenever the server sends a fresh one
  // (navigation or router.refresh after a mutation).
  useEffect(() => {
    setTrades(initialTrades);
  }, [initialTrades]);

  // Long-press (mobile) / right-click (desktop) opens an action menu per trade.
  const [menuTrade, setMenuTrade] = useState<Trade | null>(null);
  const [editTrade, setEditTrade] = useState<Trade | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  // When the menu opens from a long-press, the finger is still down — the
  // following touchend/click can land on a menu item and "select" it by accident.
  // We stamp the open time and ignore menu taps that arrive within this window.
  const menuOpenedAt = useRef(0);

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
      menuOpenedAt.current = Date.now();
      // The long press can start a native text selection; clear it so the menu
      // doesn't open over highlighted text.
      if (typeof window !== "undefined") window.getSelection()?.removeAllRanges();
      setMenuTrade(t);
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(15);
    }, 500);
  }

  function cancelPress() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  }

  // Run a menu action only if a fresh, deliberate tap (not the lingering touch
  // from the long-press that opened the menu).
  function menuAction(fn: () => void) {
    return () => {
      if (Date.now() - menuOpenedAt.current < 400) return;
      fn();
    };
  }

  function openTrade(t: Trade) {
    // A normal tap on the row opens the trade; a long-press is handled separately
    // and must not also navigate.
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    router.push(`/trades/${t.id}`);
  }

  async function onDelete(t: Trade) {
    if (!confirm(`למחוק את העסקה ${t.symbol}? פעולה זו אינה הפיכה.`)) return;
    setMenuTrade(null);
    // Optimistic remove, then reconcile with the DB (restore on failure).
    const prev = trades;
    setTrades((ts) => ts.filter((x) => x.id !== t.id));
    const supabase = createClient();
    const { error } = await supabase.from("trades").delete().eq("id", t.id);
    if (error) {
      setTrades(prev);
      alert(`מחיקה נכשלה: ${error.message}`);
      return;
    }
    router.refresh();
  }

  // A trade was added: drop it into the list and jump to its bucket right away,
  // then reconcile with the server in the background.
  function onAdded(t?: Trade) {
    if (t) {
      setTrades((ts) => [t, ...ts.filter((x) => x.id !== t.id)]);
      setFilter(isClosed(t) ? "closed" : "open");
    } else {
      setFilter("open");
    }
    router.refresh();
  }

  // A trade was edited via the modal: swap it in place, then reconcile.
  function onSaved(t: Trade) {
    setTrades((ts) => ts.map((x) => (x.id === t.id ? t : x)));
    router.refresh();
  }

  // Unrealized gross for an open position from the live quote (null if no price).
  const liveGross = (t: Trade): number | null => {
    const price = quotes[t.symbol.toUpperCase()];
    if (price == null) return null;
    const raw = (price - t.entry_price) * t.quantity;
    return t.direction === "long" ? raw : -raw;
  };

  const liveNet = (t: Trade): number | null => {
    const gross = liveGross(t);
    if (gross == null) return null;
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
          onAdded={onAdded}
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
        טיפ: הקשה על עסקה פותחת את הפרטים. לחיצה ארוכה (או קליק ימני) פותחת עריכה ומחיקה.
      </p>

      <div className="bg-surface border border-border rounded-xl overflow-x-auto select-none [-webkit-user-select:none] [-webkit-touch-callout:none]">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted text-xs uppercase tracking-wide border-b border-border">
              <th className="text-start font-medium px-4 py-3">סימול</th>
              <th className="text-start font-medium px-4 py-3">כיוון</th>
              <th className="text-end font-medium px-4 py-3">כניסה</th>
              <th className="text-end font-medium px-4 py-3">כמות</th>
              <th className="text-end font-medium px-4 py-3">גודל פוזיציה</th>
              <th className="text-end font-medium px-4 py-3">תאריך</th>
              <th className="text-end font-medium px-4 py-3">
                {filter === "closed" ? "תשואה" : "תשואה (חי)"}
              </th>
              <th className="text-end font-medium px-4 py-3">
                {filter === "closed" ? "ברוטו" : "ברוטו (חי)"}
              </th>
              <th className="text-end font-medium px-4 py-3">
                {filter === "closed" ? "נטו" : "נטו (חי)"}
              </th>
              <th className="text-start font-medium px-4 py-3">סטאפ</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted">
                  אין עסקאות {filter === "open" ? "פתוחות" : "סגורות"} עדיין.
                </td>
              </tr>
            )}
            {rows.map((t) => {
              const ccy = t.native_currency as Currency;
              // Closed trades show realized P&L; open trades show live unrealized.
              const gross = filter === "closed" ? grossPnl(t) : liveGross(t);
              const net = filter === "closed" ? netPnl(t) : liveNet(t);
              const pct = gross == null ? null : percentReturn(gross, t);
              return (
                <tr
                  key={t.id}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    menuOpenedAt.current = Date.now();
                    setMenuTrade(t);
                  }}
                  onTouchStart={() => startPress(t)}
                  onTouchEnd={cancelPress}
                  onTouchMove={cancelPress}
                  onTouchCancel={cancelPress}
                  onClick={() => openTrade(t)}
                  onClickCapture={(e) => {
                    // Swallow the click that would otherwise fire after a long press.
                    if (longPressed.current) {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                  className="border-b border-border/60 hover:bg-surface-2/50 select-none cursor-pointer [-webkit-touch-callout:none]"
                >
                  <td className="px-4 py-3">
                    <span className="font-medium">{t.symbol}</span>
                    <span className="text-muted text-xs ms-1">{ccy}</span>
                  </td>
                  <td className="px-4 py-3">{t.direction === "long" ? "לונג" : "שורט"}</td>
                  <td className="px-4 py-3 text-end tnum">{formatMoney(t.entry_price, ccy)}</td>
                  <td className="px-4 py-3 text-end tnum">{formatNumber(t.quantity, 0)}</td>
                  <td className="px-4 py-3 text-end tnum">{formatMoney(positionSize(t), ccy)}</td>
                  <td className="px-4 py-3 text-end tnum text-muted">{t.entry_date}</td>
                  <td className={`px-4 py-3 text-end tnum ${pnlColor(pct ?? 0)}`}>
                    {pct == null
                      ? "—"
                      : `${pct > 0 ? "+" : ""}${formatPercent(pct)}`}
                  </td>
                  <td className={`px-4 py-3 text-end tnum ${pnlColor(gross ?? 0)}`}>
                    {gross == null ? "—" : formatMoney(gross, ccy, { signed: true })}
                  </td>
                  <td className={`px-4 py-3 text-end tnum ${pnlColor(net ?? 0)}`}>
                    {net == null ? "—" : formatMoney(net, ccy, { signed: true })}
                  </td>
                  <td className="px-4 py-3 text-muted">{strategyName(t.strategy_id)}</td>
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
          onClick={menuAction(() => setMenuTrade(null))}
        >
          <div
            className="bg-surface border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 text-center text-sm text-muted">
              {menuTrade.symbol} · {menuTrade.direction === "long" ? "לונג" : "שורט"}
            </div>
            <button
              onClick={menuAction(() => {
                setEditTrade(menuTrade);
                setMenuTrade(null);
              })}
              className="w-full text-start px-4 py-3 rounded-lg hover:bg-surface-2 text-sm"
            >
              ✏️ עריכת עסקה
            </button>
            <button
              onClick={menuAction(() => onDelete(menuTrade))}
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
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
