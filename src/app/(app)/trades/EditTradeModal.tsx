"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Strategy, Trade } from "@/lib/types";

// Edit an existing trade. Mirrors the fields of AddTradeForm but pre-filled and
// issued as an UPDATE. Reached from the long-press action menu on the trades list.
export function EditTradeModal({
  trade,
  strategies,
  onClose,
}: {
  trade: Trade;
  strategies: Strategy[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const str = (n: number | null) => (n == null ? "" : String(n));

  const [form, setForm] = useState({
    symbol: trade.symbol,
    direction: trade.direction as string,
    native_currency: trade.native_currency as string,
    entry_date: trade.entry_date,
    entry_price: String(trade.entry_price),
    quantity: String(trade.quantity),
    commission_per_side: str(trade.commission_per_side),
    strategy_id: trade.strategy_id ?? "",
    stop_loss: str(trade.stop_loss),
    target_price: str(trade.target_price),
    exit_date: trade.exit_date ?? "",
    exit_price: str(trade.exit_price),
    notes: trade.notes ?? "",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const num = (v: string): number | null => (v.trim() === "" ? null : Number(v));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.symbol.trim() || !form.entry_price || !form.quantity) {
      setError("חובה למלא סימול, מחיר כניסה וכמות.");
      return;
    }
    const exitPrice = num(form.exit_price);
    const exitDate = form.exit_date || null;
    if ((exitPrice == null) !== (exitDate == null)) {
      setError("לעסקה סגורה צריך גם מחיר יציאה וגם תאריך יציאה.");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("trades")
      .update({
        symbol: form.symbol.trim().toUpperCase(),
        direction: form.direction,
        native_currency: form.native_currency,
        entry_date: form.entry_date,
        entry_price: Number(form.entry_price),
        quantity: Number(form.quantity),
        commission_per_side: num(form.commission_per_side) ?? 0,
        strategy_id: form.strategy_id || null,
        stop_loss: num(form.stop_loss),
        target_price: num(form.target_price),
        exit_date: exitDate,
        exit_price: exitPrice,
        notes: form.notes.trim() || null,
      })
      .eq("id", trade.id);

    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    onClose();
    router.refresh();
  }

  const field =
    "bg-surface-2 border border-border rounded-md px-3 py-2 outline-none focus:border-accent text-sm w-full";
  const labelCls = "block text-xs text-muted mb-1";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
    >
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">עריכת עסקה — {trade.symbol}</h2>
          <button type="button" onClick={onClose} className="text-muted text-sm px-2">
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>סימול *</label>
            <input
              className={field}
              value={form.symbol}
              onChange={(e) => set("symbol", e.target.value)}
              placeholder="AAPL"
            />
          </div>
          <div>
            <label className={labelCls}>כיוון</label>
            <select
              className={field}
              value={form.direction}
              onChange={(e) => set("direction", e.target.value)}
            >
              <option value="long">לונג</option>
              <option value="short">שורט</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>מטבע</label>
            <select
              className={field}
              value={form.native_currency}
              onChange={(e) => set("native_currency", e.target.value)}
            >
              <option value="USD">דולר ($)</option>
              <option value="ILS">שקל (₪)</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>תאריך כניסה</label>
            <input
              type="date"
              className={field}
              value={form.entry_date}
              onChange={(e) => set("entry_date", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>מחיר כניסה *</label>
            <input
              type="number"
              step="any"
              inputMode="decimal"
              className={field}
              value={form.entry_price}
              onChange={(e) => set("entry_price", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>כמות *</label>
            <input
              type="number"
              step="any"
              inputMode="decimal"
              className={field}
              value={form.quantity}
              onChange={(e) => set("quantity", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>עמלה לכל צד</label>
            <input
              type="number"
              step="any"
              inputMode="decimal"
              className={field}
              value={form.commission_per_side}
              onChange={(e) => set("commission_per_side", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>סטאפ</label>
            <select
              className={field}
              value={form.strategy_id}
              onChange={(e) => set("strategy_id", e.target.value)}
            >
              <option value="">—</option>
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>סטופ לוס</label>
            <input
              type="number"
              step="any"
              inputMode="decimal"
              className={field}
              value={form.stop_loss}
              onChange={(e) => set("stop_loss", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>מחיר יעד</label>
            <input
              type="number"
              step="any"
              inputMode="decimal"
              className={field}
              value={form.target_price}
              onChange={(e) => set("target_price", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>תאריך יציאה</label>
            <input
              type="date"
              className={field}
              value={form.exit_date}
              onChange={(e) => set("exit_date", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>מחיר יציאה</label>
            <input
              type="number"
              step="any"
              inputMode="decimal"
              className={field}
              value={form.exit_price}
              onChange={(e) => set("exit_price", e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>הערות</label>
            <input
              className={field}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-neg text-sm">{error}</p>}

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={busy}
            className="bg-accent text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {busy ? "שומר…" : "שמירת שינויים"}
          </button>
          <button type="button" onClick={onClose} className="text-muted text-sm px-3 py-2">
            ביטול
          </button>
        </div>
      </form>
    </div>
  );
}
