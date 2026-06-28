"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/format";
import type { Trade } from "@/lib/types";

const today = () => new Date().toISOString().slice(0, 10);

// Closing a position is recorded as one or more partial closes. Each close is a
// tranche (quantity + price + date + commission); the trade stays OPEN until the
// tranches fill the original quantity, at which point close_trade_partial stamps
// the quantity-weighted average exit onto the parent and it becomes "closed".
export function CloseTradeForm({ trade, remaining }: { trade: Trade; remaining: number }) {
  const router = useRouter();
  const [qty, setQty] = useState(String(remaining));
  const [exitPrice, setExitPrice] = useState("");
  const [exitDate, setExitDate] = useState(today());
  const [commission, setCommission] = useState(String(trade.commission_per_side ?? 0));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qtyNum = Number(qty);
  const isFull = qtyNum >= remaining;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!exitPrice) {
      setError("יש להזין מחיר יציאה.");
      return;
    }
    if (!(qtyNum > 0)) {
      setError("יש להזין כמות חיובית.");
      return;
    }
    if (qtyNum > remaining + 1e-9) {
      setError(`הכמות גדולה מהיתרה (${formatNumber(remaining, 0)}).`);
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("close_trade_partial", {
      p_trade_id: trade.id,
      p_qty: qtyNum,
      p_price: Number(exitPrice),
      p_date: exitDate,
      p_commission: Number(commission) || 0,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    // A partial close keeps us on the trade (refresh to show the new remaining);
    // a full close sends us back to the list where it lands in "closed".
    if (isFull) {
      router.push("/trades");
    }
    router.refresh();
  }

  const field =
    "bg-surface-2 border border-border rounded-md px-3 py-2 outline-none focus:border-accent text-sm";

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs text-muted mb-1">
          כמות לסגירה (נותרו {formatNumber(remaining, 0)})
        </label>
        <input
          type="number"
          step="any"
          inputMode="decimal"
          className={field}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs text-muted mb-1">מחיר יציאה</label>
        <input
          type="number"
          step="any"
          inputMode="decimal"
          className={field}
          value={exitPrice}
          onChange={(e) => setExitPrice(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs text-muted mb-1">תאריך יציאה</label>
        <input
          type="date"
          className={field}
          value={exitDate}
          onChange={(e) => setExitDate(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs text-muted mb-1">עמלה</label>
        <input
          type="number"
          step="any"
          inputMode="decimal"
          className={field}
          value={commission}
          onChange={(e) => setCommission(e.target.value)}
        />
      </div>
      <button
        type="submit"
        disabled={busy}
        className="bg-accent text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
      >
        {busy ? "…" : isFull ? "סגור עסקה" : "מימוש חלקי"}
      </button>
      {error && <p className="text-neg text-sm w-full">{error}</p>}
    </form>
  );
}
