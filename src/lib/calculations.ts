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

import type { Currency, Timeframe, Trade } from "./types";

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
// portfolio = initial_capital + Σ(net realized) + net unrealized, ALWAYS net
// (a 25% tax provision is applied to unrealized P&L too, so the figure answers
// "what's left if I liquidate right now"). Shown in both currencies; the two
// displays breathe with FX in OPPOSITE directions — that divergence is the
// signal separating currency moves from trading.

export interface PortfolioInput {
  initialCapitalUsd: number;
  initialCapitalIls: number;
  closedTrades: Trade[];
  openTrades: Trade[];
  /** Live price per symbol, in the symbol's native currency. */
  quotes: Record<string, number>;
  /** USD/ILS rate = how many ILS per 1 USD. */
  fxRate: number;
}

export interface PortfolioValue {
  usd: number; // total net worth expressed in USD
  ils: number; // total net worth expressed in ILS
  nativeUsd: number; // sum of USD-denominated holdings (pre-conversion)
  nativeIls: number; // sum of ILS-denominated holdings (pre-conversion)
}

/** Net realized + net unrealized accumulated per native currency. */
function nativeNetWorth(input: PortfolioInput): { USD: number; ILS: number } {
  const acc: Record<Currency, number> = {
    USD: input.initialCapitalUsd,
    ILS: input.initialCapitalIls,
  };

  for (const t of input.closedTrades) {
    acc[t.native_currency] += netPnl(t) ?? 0;
  }

  for (const t of input.openTrades) {
    const price = input.quotes[t.symbol];
    if (price == null) continue;
    const raw = (price - t.entry_price) * t.quantity;
    const gross = t.direction === "long" ? raw : -raw;
    acc[t.native_currency] += netFromGross(gross, totalCommissions(t));
  }

  return acc;
}

export function portfolioValue(input: PortfolioInput): PortfolioValue {
  const { USD, ILS } = nativeNetWorth(input);
  const fx = input.fxRate;
  return {
    nativeUsd: USD,
    nativeIls: ILS,
    // Express everything in one currency. USD strengthening (fx up) lifts the
    // ILS view and dents the USD view — opposite directions, by design.
    usd: USD + (fx > 0 ? ILS / fx : 0),
    ils: ILS + USD * fx,
  };
}
