// ─────────────────────────────────────────────────────────────────────────────
// Calculations — the single, pure, unit-tested heart of "fidelity".
//
// ALL P&L / tax / R / FX math lives here. Nothing in this file performs I/O or
// depends on React, Supabase, or the network. Everything is derived from raw
// trade fields so the numbers can never drift between screens.
//
// MONEY MODEL (three layers, kept separate):
//   1. gross  — pure trading skill. (sell − buy) × qty, direction-adjusted,
//               in the trade's native currency. No commissions, no tax.
//   2. net    — gross minus friction. Tax is on profit AFTER commissions:
//               net = 0.75 × (gross − 2 × commission_per_side)
//   3. tax    — a separate rolling balance. POSITIVE = you owe the state,
//               NEGATIVE = you've accrued a credit. Resets Jan 1.
//               delta = 0.25 × (gross − 2 × commission_per_side)
//
// FX never enters trade-level statistics — only the portfolio display.
// ─────────────────────────────────────────────────────────────────────────────

import type { Currency, Timeframe, Trade, TradeClose } from "./types";

/** Israeli capital-gains tax. */
export const CAPITAL_GAINS_TAX_RATE = 0.25;

// ── Per-trade primitives ─────────────────────────────────────────────────────

export function isClosed(trade: Trade): boolean {
  return trade.exit_price != null && trade.exit_date != null;
}

/**
 * Gross P&L in the trade's native currency, direction-adjusted.
 * Returns null for open trades (no exit yet).
 */
export function grossPnl(trade: Trade): number | null {
  if (trade.exit_price == null) return null;
  const raw = (trade.exit_price - trade.entry_price) * trade.quantity;
  return trade.direction === "long" ? raw : -raw;
}

/** Total commissions for the round trip: entry + exit. */
export function totalCommissions(trade: Trade): number {
  return 2 * trade.commission_per_side;
}

/** Notional position size in the trade's native currency: entry price × quantity. */
export function positionSize(trade: Trade): number {
  return trade.entry_price * trade.quantity;
}

/**
 * Return as a fraction of the position's cost basis (entry price × quantity),
 * computed from a gross P&L figure. Works for both realized (closed) gross and
 * live (open) unrealized gross. Returns null when there's no cost basis.
 */
export function percentReturn(gross: number, trade: Trade): number | null {
  const size = positionSize(trade);
  return size === 0 ? null : gross / size;
}

/** Profit after commissions — the base the tax is computed on. */
export function taxableBase(trade: Trade): number | null {
  const gross = grossPnl(trade);
  if (gross == null) return null;
  return gross - totalCommissions(trade);
}

/**
 * Tax effect of a single trade. POSITIVE = liability (you owe),
 * NEGATIVE = credit (tax shield from a loss).
 */
export function taxAmount(trade: Trade): number | null {
  const base = taxableBase(trade);
  if (base == null) return null;
  return CAPITAL_GAINS_TAX_RATE * base;
}

/** Net P&L: profit after commissions and after the 25% tax provision. */
export function netPnl(trade: Trade): number | null {
  const base = taxableBase(trade);
  if (base == null) return null;
  return base - CAPITAL_GAINS_TAX_RATE * base; // = 0.75 × base
}

/** Risk in native currency: |entry − stop| × qty. Null if no stop set. */
export function riskAmount(trade: Trade): number | null {
  if (trade.stop_loss == null) return null;
  const risk = Math.abs(trade.entry_price - trade.stop_loss) * trade.quantity;
  return risk > 0 ? risk : null;
}

/**
 * R multiple = gross / risk. Computed under the hood; per-trade R is NEVER
 * displayed — only the aggregate average (see computeStats).
 */
export function rMultiple(trade: Trade): number | null {
  const gross = grossPnl(trade);
  const risk = riskAmount(trade);
  if (gross == null || risk == null) return null;
  return gross / risk;
}

/**
 * Net derived directly from a gross figure and a round-trip commission.
 * Used for unrealized P&L on open positions ("what's left if I liquidate now").
 */
export function netFromGross(gross: number, roundTripCommission: number): number {
  const base = gross - roundTripCommission;
  return base - CAPITAL_GAINS_TAX_RATE * base;
}

// ── Partial closes ───────────────────────────────────────────────────────────
// A trade is closed in tranches (see TradeClose). The parent trade row stays
// open — its `quantity` is the ORIGINAL size — until the closes fill it. Realized
// P&L from tranches taken so far feeds the live portfolio immediately, but the
// trade enters statistics/tax/equity only once FULLY closed (where its stored
// exit_price is already the weighted average of these tranches).

/** Quantity realized so far across a trade's partial closes. */
export function closedQuantity(closes: TradeClose[]): number {
  return closes.reduce((sum, c) => sum + c.quantity, 0);
}

/** Still-open quantity: original quantity minus everything closed so far. */
export function remainingQuantity(trade: Trade, closes: TradeClose[]): number {
  return trade.quantity - closedQuantity(closes);
}

/**
 * Realized NET P&L from the partial closes taken on a still-open trade.
 * Each tranche is netted against its own exit commission plus a pro-rata share
 * of the single entry commission (so a one-shot full close via this path equals
 * the classic 2 × commission_per_side round trip). Direction-adjusted, so shorts
 * realize a profit when the close price is below entry.
 */
export function realizedNetFromCloses(trade: Trade, closes: TradeClose[]): number {
  let net = 0;
  for (const c of closes) {
    const raw = (c.close_price - trade.entry_price) * c.quantity;
    const gross = trade.direction === "long" ? raw : -raw;
    const entryShare =
      trade.quantity > 0 ? trade.commission_per_side * (c.quantity / trade.quantity) : 0;
    net += netFromGross(gross, c.commission + entryShare);
  }
  return net;
}

// ── Time filtering ───────────────────────────────────────────────────────────
// Calendar-based windows relative to `now`. Closed trades are placed by
// exit_date; this keeps the "Year" view aligned with the Jan-1 tax reset.

function startOfTimeframe(timeframe: Timeframe, now: Date): Date | null {
  const y = now.getFullYear();
  switch (timeframe) {
    case "month":
      return new Date(y, now.getMonth(), 1);
    case "quarter":
      return new Date(y, Math.floor(now.getMonth() / 3) * 3, 1);
    case "year":
      return new Date(y, 0, 1);
    case "all":
      return null;
  }
}

/** Closed trades whose exit_date falls within the timeframe (relative to now). */
export function filterClosedByTimeframe(
  trades: Trade[],
  timeframe: Timeframe,
  now: Date = new Date()
): Trade[] {
  const start = startOfTimeframe(timeframe, now);
  return trades.filter((t) => {
    if (!isClosed(t) || t.exit_date == null) return false;
    if (start == null) return true;
    return new Date(t.exit_date) >= start;
  });
}

// ── Statistics — the scoreboard ──────────────────────────────────────────────
// All GROSS (they measure the trader), EXCEPT profit factor which is shown
// twice. The gap between gross and net PF is the cost of friction.

export interface Stats {
  totalTrades: number; // closed trades in the window
  winRate: number; // 0..1 (gross > 0)
  averageWin: number; // gross, average of winners (>= 0)
  averageLoss: number; // gross, average of losers (<= 0)
  profitFactorGross: number | null; // Σ gross wins / |Σ gross losses|
  profitFactorNet: number | null; // Σ net wins / |Σ net losses|
  averageR: number | null; // aggregate only, never per-trade
  totalGross: number;
  totalNet: number;
}

/**
 * The one pure function: (closed trades) → all statistics.
 * Pass an already time-filtered, single-currency set. Profit factor is null
 * when there are no losses (division by zero is not a "PF of infinity" we show).
 */
export function computeStats(closedTrades: Trade[]): Stats {
  let wins = 0;
  let grossWinSum = 0;
  let grossLossSum = 0; // negative
  let netWinSum = 0;
  let netLossSum = 0; // negative
  let totalGross = 0;
  let totalNet = 0;

  let rSum = 0;
  let rCount = 0;

  for (const t of closedTrades) {
    const gross = grossPnl(t);
    const net = netPnl(t);
    if (gross == null || net == null) continue;

    totalGross += gross;
    totalNet += net;

    if (gross > 0) {
      wins += 1;
      grossWinSum += gross;
    } else if (gross < 0) {
      grossLossSum += gross;
    }

    if (net > 0) netWinSum += net;
    else if (net < 0) netLossSum += net;

    const r = rMultiple(t);
    if (r != null) {
      rSum += r;
      rCount += 1;
    }
  }

  const total = closedTrades.length;
  const losers = closedTrades.filter((t) => {
    const g = grossPnl(t);
    return g != null && g < 0;
  }).length;

  return {
    totalTrades: total,
    winRate: total > 0 ? wins / total : 0,
    averageWin: wins > 0 ? grossWinSum / wins : 0,
    averageLoss: losers > 0 ? grossLossSum / losers : 0,
    profitFactorGross: grossLossSum < 0 ? grossWinSum / Math.abs(grossLossSum) : null,
    profitFactorNet: netLossSum < 0 ? netWinSum / Math.abs(netLossSum) : null,
    averageR: rCount > 0 ? rSum / rCount : null,
    totalGross,
    totalNet,
  };
}

// ── Tax balance ──────────────────────────────────────────────────────────────

/**
 * Rolling tax balance over the supplied (already time-filtered) closed trades.
 * POSITIVE = you owe; NEGATIVE = accrued credit. At the "Year" view this is the
 * calendar-year balance that conceptually resets Jan 1.
 */
export function taxBalance(closedTrades: Trade[]): number {
  return closedTrades.reduce((sum, t) => sum + (taxAmount(t) ?? 0), 0);
}

// ── Equity curve ─────────────────────────────────────────────────────────────

export interface EquityPoint {
  date: string; // ISO date of the closing trade
  gross: number; // cumulative gross
  net: number; // cumulative net
}

/**
 * Cumulative gross/net equity over time, ordered by exit_date. Pass the
 * time-filtered closed set; the curve starts at the first close in the window.
 */
export function equityCurve(closedTrades: Trade[]): EquityPoint[] {
  const sorted = [...closedTrades]
    .filter((t) => t.exit_date != null)
    .sort((a, b) => new Date(a.exit_date!).getTime() - new Date(b.exit_date!).getTime());

  let cumGross = 0;
  let cumNet = 0;
  return sorted.map((t) => {
    cumGross += grossPnl(t) ?? 0;
    cumNet += netPnl(t) ?? 0;
    return { date: t.exit_date!, gross: cumGross, net: cumNet };
  });
}

// ── Portfolio value (state, not statistics) ──────────────────────────────────
// The portfolio is shown the way a brokerage account is, as three live parts:
//
//   portfolio = CASH + POSITION COST (at entry) + LIVE UNREALIZED NET
//
//   • CASH          initial capital + realized net (closed trades AND partial
//                   closes of still-open trades) − capital tied up in still-open
//                   LONG positions at their ENTRY cost. SHORTS do not consume
//                   cash (they are opened by borrowing), so they never reduce it.
//   • POSITION COST entry_price × remaining_qty for open LONG positions only —
//                   the ENTRY cost, not a live price. A SHORT pays no cash and
//                   owns no asset of that notional value, so it contributes
//                   NOTHING here; only its live P&L (below) belongs in the value.
//   • LIVE NET      direction-adjusted unrealized P&L on the remaining quantity,
//                   net of commissions and a 25% tax provision ("if I liquidate
//                   now"). The only part that moves in real time. For a short the
//                   whole portfolio contribution is just this P&L.
//
// The total equals the classic  initial + Σ realized net + Σ unrealized net  —
// nothing about the headline number changes, it is just made legible: the cost
// basis that used to hide inside "initial capital" is now an explicit line, so
// open positions are visibly part of the value.
//
// Shown in both currencies; the two views breathe with FX in OPPOSITE directions
// — that divergence is the signal separating currency moves from trading.

export interface PortfolioInput {
  initialCapitalUsd: number;
  initialCapitalIls: number;
  closedTrades: Trade[];
  openTrades: Trade[];
  /** Live price per symbol, in the symbol's native currency. */
  quotes: Record<string, number>;
  /** USD/ILS rate = how many ILS per 1 USD. */
  fxRate: number;
  /** Partial-close tranches for open trades, keyed by trade id. */
  closesByTrade?: Record<string, TradeClose[]>;
}

interface NativeParts {
  cash: number;
  openCost: number;
  openLiveNet: number;
}

export interface PortfolioValue {
  usd: number; // total net worth expressed in USD
  ils: number; // total net worth expressed in ILS
  nativeUsd: number; // sum of USD-denominated holdings (pre-conversion)
  nativeIls: number; // sum of ILS-denominated holdings (pre-conversion)
  // Breakdown per native currency (state, pre-FX) — see the block comment above.
  cashUsd: number;
  cashIls: number;
  openCostUsd: number;
  openCostIls: number;
  openLiveNetUsd: number;
  openLiveNetIls: number;
}

/** Cash / position-cost / live-net split, accumulated per native currency. */
function nativeBreakdown(input: PortfolioInput): Record<Currency, NativeParts> {
  const acc: Record<Currency, NativeParts> = {
    USD: { cash: input.initialCapitalUsd, openCost: 0, openLiveNet: 0 },
    ILS: { cash: input.initialCapitalIls, openCost: 0, openLiveNet: 0 },
  };

  // Realized net from fully-closed trades lands in cash.
  for (const t of input.closedTrades) {
    acc[t.native_currency].cash += netPnl(t) ?? 0;
  }

  for (const t of input.openTrades) {
    const parts = acc[t.native_currency];
    const closes = input.closesByTrade?.[t.id] ?? [];
    const remaining = remainingQuantity(t, closes);

    // Realized net from partial closes already taken → cash, in real time.
    parts.cash += realizedNetFromCloses(t, closes);

    // A LONG ties up cash at its ENTRY cost: the money leaves cash and becomes a
    // held position of equal value (net zero at entry). A SHORT is opened by
    // BORROWING — no cash is paid and nothing of that notional is owned — so it
    // touches neither cash nor position cost; only its live P&L (below) counts.
    if (t.direction === "long") {
      const cost = t.entry_price * remaining;
      parts.cash -= cost;
      parts.openCost += cost;
    }

    // Live unrealized net on the remaining quantity. Quote keys are uppercase
    // (the /api/quote route and the live-quote hook normalise symbols), so match
    // that here. If the live price is momentarily missing we leave the position
    // at break-even (a long stays at entry cost, a short adds nothing) rather
    // than dropping it — the value never collapses unexpectedly.
    const price = input.quotes[t.symbol.toUpperCase()];
    if (price == null) continue;
    const raw = (price - t.entry_price) * remaining;
    const gross = t.direction === "long" ? raw : -raw;
    parts.openLiveNet += netFromGross(gross, totalCommissions(t));
  }

  return acc;
}

export function portfolioValue(input: PortfolioInput): PortfolioValue {
  const b = nativeBreakdown(input);
  const USD = b.USD.cash + b.USD.openCost + b.USD.openLiveNet;
  const ILS = b.ILS.cash + b.ILS.openCost + b.ILS.openLiveNet;
  const fx = input.fxRate;
  return {
    nativeUsd: USD,
    nativeIls: ILS,
    // Express everything in one currency. USD strengthening (fx up) lifts the
    // ILS view and dents the USD view — opposite directions, by design.
    usd: USD + (fx > 0 ? ILS / fx : 0),
    ils: ILS + USD * fx,
    cashUsd: b.USD.cash,
    cashIls: b.ILS.cash,
    openCostUsd: b.USD.openCost,
    openCostIls: b.ILS.openCost,
    openLiveNetUsd: b.USD.openLiveNet,
    openLiveNetIls: b.ILS.openLiveNet,
  };
}
