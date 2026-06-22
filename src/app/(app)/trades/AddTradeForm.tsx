"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Strategy } from "@/lib/types";

const today = () => new Date().toISOString().slice(0, 10);

// The add-trade form is make-or-break: minimum fields up top, optional plan /
// exit fields tucked behind "More". Logging a trade should take seconds.
export function AddTradeForm({
  strategies,
  defaultCommission,
  onAdded,
}: {
  strategies: Strategy[];
  defaultCommission: number;
  onAdded: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    symbol: "",
    direction: "long",
    native_currency: "USD",
    entry_date: today(),
    entry_price: "",
    quantity: "",
    commission_per_side: String(defaultCommission || ""),
    strategy_id: "",
    stop_loss: "",
    target_price: "",
    exit_date: "",
    exit_price: "",
    notes: "",
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("לא מחובר.");
      setBusy(false);
      return;
    }

    const { error } = await supabase.from("trades").insert({
      user_id: user.id,
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
    });

    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }

    setForm((f) => ({
      ...f,
      symbol: "",
      entry_price: "",
      quantity: "",
      stop_loss: "",
      target_price: "",
      exit_date: "",
      exit_price: "",
      notes: "",
    }));
    setOpen(false);
    onAdded();
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-accent text-white rounded-md px-4 py-2 text-sm font-medium"
      >
        + עסקה חדשה
      </button>
    );
  }

  const field =
    "bg-surface-2 border border-border rounded-md px-3 py-2 outline-none focus:border-accent text-sm w-full";
  const labelCls = "block text-xs text-muted mb-1";

  return (
    <form onSubmit={onSubmit} className="bg-surface border border-border rounded-xl p-5 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className={labelCls}>סימול *</label>
          <input
            autoFocus
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
      </div>

      <button
        type="button"
        onClick={() => setShowMore((v) => !v)}
        className="text-xs text-accent"
      >
        {showMore ? "− פחות" : "+ תכנון ויציאה (לא חובה)"}
      </button>

      {showMore && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
          <div className="col-span-2 md:col-span-4">
            <label className={labelCls}>הערות</label>
            <input
              className={field}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
        </div>
      )}

      {error && <p className="text-neg text-sm">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="bg-accent text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {busy ? "שומר…" : "שמירת עסקה"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-muted text-sm px-3 py-2"
        >
          ביטול
        </button>
      </div>
    </form>
  );
}
