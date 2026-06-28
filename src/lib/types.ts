// ── Domain types ─────────────────────────────────────────────────────────────
// Shared across the data layer, the calculations module, and the UI.

export type AssetType = "stock"; // crypto deferred — the field anticipates it.
export type Direction = "long" | "short";
export type Currency = "USD" | "ILS";
export type TradeStatus = "open" | "closed";

/** The single global time window. No component holds its own timeframe. */
export type Timeframe = "month" | "quarter" | "year" | "all";

/**
 * A trade as stored. P&L / tax / R are NEVER stored — they are derived in the
 * calculations module from these raw fields. `status` derives from `exit_price`.
 *
 * `commission_per_side` is a single per-action commission; it is charged twice
 * (entry + exit) when computing net.
 */
export interface Trade {
  id: string;
  user_id: string;
  symbol: string;
  asset_type: AssetType;
  direction: Direction;
  native_currency: Currency;
  entry_date: string; // ISO date
  entry_price: number;
  quantity: number;
  exit_date: string | null;
  exit_price: number | null;
  commission_per_side: number;
  stop_loss: number | null;
  target_price: number | null;
  strategy_id: string | null;
  notes: string | null;
  screenshot_url: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * One partial realization of a trade. A position is closed in tranches; the
 * parent Trade stays open (its `quantity` is the ORIGINAL size) until the sum of
 * its closes fills it, at which point the parent's `exit_price` becomes the
 * quantity-weighted average of these closes. P&L is NEVER stored here either —
 * it's derived from the parent's entry and these raw close fields.
 */
export interface TradeClose {
  id: string;
  trade_id: string;
  user_id: string;
  quantity: number;
  close_price: number;
  close_date: string; // ISO date
  commission: number; // exit-side commission for this tranche
  created_at: string;
}

export interface Strategy {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Profile {
  id: string; // === auth.uid()
  initial_capital_usd: number;
  initial_capital_ils: number;
  default_commission: number;
  created_at: string;
  updated_at: string;
}

/** A live quote for an open position's symbol, in the symbol's native currency. */
export type QuoteMap = Record<string, number>;
