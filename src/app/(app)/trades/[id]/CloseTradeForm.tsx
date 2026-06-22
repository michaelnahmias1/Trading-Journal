"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const today = () => new Date().toISOString().slice(0, 10);

// Closing a position is just setting exit price + date — status derives from it.
export function CloseTradeForm({ tradeId }: { tradeId: string }) {
  const router = useRouter();
  const [exitPrice, setExitPrice] = useState("");
  const [exitDate, setExitDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!exitPrice) {
      setError("יש להזין מחיר יציאה.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("trades")
      .update({ exit_price: Number(exitPrice), exit_date: exitDate })
      .eq("id", tradeId);
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.refresh();
  }

  const field =
    "bg-surface-2 border border-border rounded-md px-3 py-2 outline-none focus:border-accent text-sm";

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
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
      <button
        type="submit"
        disabled={busy}
        className="bg-accent text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
      >
        {busy ? "…" : "סגור עסקה"}
      </button>
      {error && <p className="text-neg text-sm w-full">{error}</p>}
    </form>
  );
}
