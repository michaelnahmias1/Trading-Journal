import { describe, expect, it } from "vitest";
import {
  closedQuantity,
  computeStats,
  equityCurve,
  filterClosedByTimeframe,
  grossPnl,
  netFromGross,
  netPnl,
  percentReturn,
  portfolioValue,
  positionSize,
  realizedNetFromCloses,
  remainingQuantity,
  rMultiple,
  taxAmount,
  taxableBase,
  taxBalance,
} from "./calculations";
import type { Trade, TradeClose } from "./types";

// A minimal trade factory — only the fields a test cares about need overriding.
function makeTrade(over: Partial<Trade> = {}): Trade {
  return {
    id: "t1",
    user_id: "u1",
    symbol: "AAPL",
    asset_type: "stock",
    direction: "long",
    native_currency: "USD",
    entry_date: "2026-01-10",
    entry_price: 100,
    quantity: 10,
    exit_date: "2026-01-20",
    exit_price: 110,
    commission_per_side: 0,
    stop_loss: null,
    target_price: null,
    strategy_id: null,
    notes: null,
    screenshot_url: null,
    created_at: "2026-01-10T00:00:00Z",
    updated_at: "2026-01-20T00:00:00Z",
    ...over,
  };
}

describe("positionSize / percentReturn", () => {
  it("position size = entry × quantity", () => {
    expect(positionSize(makeTrade({ entry_price: 100, quantity: 10 }))).toBe(1000);
  });

  it("percent return = gross / cost basis", () => {
    const t = makeTrade({ entry_price: 100, quantity: 10 }); // basis 1000
    expect(percentReturn(100, t)).toBeCloseTo(0.1); // +10%
    expect(percentReturn(-250, t)).toBeCloseTo(-0.25); // −25%
  });

  it("is null when there is no cost basis", () => {
    expect(percentReturn(50, makeTrade({ entry_price: 0, quantity: 0 }))).toBeNull();
  });
});

describe("grossPnl", () => {
  it("long: (sell − buy) × qty", () => {
    expect(grossPnl(makeTrade({ entry_price: 100, exit_price: 110, quantity: 10 }))).toBe(100);
  });

  it("short: inverted", () => {
    expect(
      grossPnl(makeTrade({ direction: "short", entry_price: 100, exit_price: 90, quantity: 10 }))
    ).toBe(100);
  });

  it("is null for an open trade", () => {
    expect(grossPnl(makeTrade({ exit_price: null, exit_date: null }))).toBeNull();
  });

  it("carries no commission or tax", () => {
    // gross ignores commissions entirely.
    expect(grossPnl(makeTrade({ commission_per_side: 5, exit_price: 110 }))).toBe(100);
  });
});

describe("net = 0.75 × (gross − 2×commission) — tax on profit AFTER commissions", () => {
  it("profitable trade with commissions", () => {
    // gross = 100, commissions = 2×5 = 10, base = 90, net = 0.75×90 = 67.5
    const t = makeTrade({ exit_price: 110, commission_per_side: 5 });
    expect(grossPnl(t)).toBe(100);
    expect(taxableBase(t)).toBe(90);
    expect(netPnl(t)).toBeCloseTo(67.5, 9);
  });

  it("no commissions → net is exactly 0.75 × gross", () => {
    const t = makeTrade({ exit_price: 110, commission_per_side: 0 });
    expect(netPnl(t)).toBeCloseTo(75, 9);
  });
});

describe("tax shield — a loss generates a CREDIT (negative tax)", () => {
  it("losing trade: taxAmount is negative (credit), net adds the shield back", () => {
    // gross = −100, commissions 0, base = −100
    const t = makeTrade({ exit_price: 90, commission_per_side: 0 });
    expect(grossPnl(t)).toBe(-100);
    // POSITIVE = owe, NEGATIVE = credit → a loss yields a negative tax amount.
    expect(taxAmount(t)).toBeCloseTo(-25, 9);
    // net loss is cushioned by the 25% shield: 0.75 × −100 = −75
    expect(netPnl(t)).toBeCloseTo(-75, 9);
  });

  it("commissions deepen the loss and the base", () => {
    // gross = −100, commissions = 2×3 = 6, base = −106
    const t = makeTrade({ exit_price: 90, commission_per_side: 3 });
    expect(taxableBase(t)).toBe(-106);
    expect(taxAmount(t)).toBeCloseTo(-26.5, 9);
    expect(netPnl(t)).toBeCloseTo(-79.5, 9);
  });
});

describe("tax balance — POSITIVE = owe, NEGATIVE = credit, running sum", () => {
  it("a winner adds liability, a loser adds credit", () => {
    const winner = makeTrade({ id: "w", exit_price: 110 }); // +100 → +25
    const loser = makeTrade({ id: "l", exit_price: 90 }); // −100 → −25
    expect(taxBalance([winner])).toBeCloseTo(25, 9);
    expect(taxBalance([loser])).toBeCloseTo(-25, 9);
    expect(taxBalance([winner, loser])).toBeCloseTo(0, 9);
  });
});

describe("R multiple — computed under the hood, aggregate only", () => {
  it("R = gross / (|entry − stop| × qty)", () => {
    // risk = |100 − 95| × 10 = 50, gross = 100 → R = 2
    const t = makeTrade({ entry_price: 100, exit_price: 110, stop_loss: 95, quantity: 10 });
    expect(rMultiple(t)).toBeCloseTo(2, 9);
  });

  it("is null without a stop", () => {
    expect(rMultiple(makeTrade({ stop_loss: null }))).toBeNull();
  });
});

describe("computeStats", () => {
  const winner = makeTrade({ id: "a", exit_price: 110 }); // gross +100, net +75
  const bigWin = makeTrade({ id: "b", exit_price: 130 }); // gross +300, net +225
  const loser = makeTrade({ id: "c", exit_price: 95 }); // gross −50, net −37.5

  it("win rate, averages, totals on gross", () => {
    const s = computeStats([winner, bigWin, loser]);
    expect(s.totalTrades).toBe(3);
    expect(s.winRate).toBeCloseTo(2 / 3, 9);
    expect(s.averageWin).toBeCloseTo(200, 9); // (100 + 300) / 2
    expect(s.averageLoss).toBeCloseTo(-50, 9);
    expect(s.totalGross).toBeCloseTo(350, 9);
    expect(s.totalNet).toBeCloseTo(262.5, 9);
  });

  it("profit factor shown twice — gross and net differ by friction", () => {
    const s = computeStats([winner, bigWin, loser]);
    // gross: wins 400 / losses 50 = 8
    expect(s.profitFactorGross).toBeCloseTo(8, 9);
    // net: wins 300 / losses 37.5 = 8 as well (no commissions here)
    expect(s.profitFactorNet).toBeCloseTo(8, 9);
  });

  it("profit factor differs once commissions exist", () => {
    const w = makeTrade({ id: "w", exit_price: 110, commission_per_side: 5 }); // gross 100, net 67.5
    const l = makeTrade({ id: "l", exit_price: 90, commission_per_side: 5 }); // gross −100, net −82.5
    const s = computeStats([w, l]);
    expect(s.profitFactorGross).toBeCloseTo(1, 9); // 100/100
    expect(s.profitFactorNet).toBeCloseTo(67.5 / 82.5, 9); // < 1: friction bites
  });

  it("null profit factor when there are no losses", () => {
    const s = computeStats([winner, bigWin]);
    expect(s.profitFactorGross).toBeNull();
  });

  it("average R only over trades that have a stop", () => {
    const r2 = makeTrade({ id: "r2", exit_price: 110, stop_loss: 95 }); // R = 2
    const r4 = makeTrade({ id: "r4", exit_price: 120, stop_loss: 95 }); // gross 200, risk 50 → R 4
    const noStop = makeTrade({ id: "ns", exit_price: 110, stop_loss: null });
    const s = computeStats([r2, r4, noStop]);
    expect(s.averageR).toBeCloseTo(3, 9); // (2 + 4) / 2, noStop excluded
  });
});

describe("filterClosedByTimeframe", () => {
  const now = new Date("2026-06-22");
  const jan = makeTrade({ id: "jan", exit_date: "2026-01-15" });
  const june = makeTrade({ id: "jun", exit_date: "2026-06-10" });
  const lastYear = makeTrade({ id: "ly", exit_date: "2025-11-01" });
  const open = makeTrade({ id: "open", exit_date: null, exit_price: null });

  it("month: only the current calendar month", () => {
    const r = filterClosedByTimeframe([jan, june, lastYear, open], "month", now);
    expect(r.map((t) => t.id)).toEqual(["jun"]);
  });

  it("year: current calendar year, excludes prior year", () => {
    const r = filterClosedByTimeframe([jan, june, lastYear, open], "year", now);
    expect(r.map((t) => t.id).sort()).toEqual(["jan", "jun"]);
  });

  it("all: every closed trade, never the open one", () => {
    const r = filterClosedByTimeframe([jan, june, lastYear, open], "all", now);
    expect(r.map((t) => t.id).sort()).toEqual(["jan", "jun", "ly"]);
  });
});

describe("equityCurve", () => {
  it("accumulates gross and net in exit-date order", () => {
    const a = makeTrade({ id: "a", exit_date: "2026-02-01", exit_price: 110 }); // +100 / +75
    const b = makeTrade({ id: "b", exit_date: "2026-03-01", exit_price: 90 }); // −100 / −75
    const curve = equityCurve([b, a]); // intentionally out of order
    expect(curve.map((p) => p.gross)).toEqual([100, 0]);
    expect(curve.map((p) => p.net)).toEqual([75, 0]);
  });
});

describe("netFromGross — used for unrealized P&L", () => {
  it("mirrors the realized formula", () => {
    expect(netFromGross(100, 10)).toBeCloseTo(67.5, 9); // 0.75 × 90
    expect(netFromGross(-100, 0)).toBeCloseTo(-75, 9); // shield on unrealized loss
  });
});

describe("portfolioValue — dual currency breathes with FX in opposite directions", () => {
  const base = {
    initialCapitalUsd: 10000,
    initialCapitalIls: 20000,
    closedTrades: [] as Trade[],
    openTrades: [] as Trade[],
    quotes: {} as Record<string, number>,
  };

  it("converts native buckets at the FX rate", () => {
    // fx = 3.7 ILS per USD
    const v = portfolioValue({ ...base, fxRate: 3.7 });
    expect(v.nativeUsd).toBe(10000);
    expect(v.nativeIls).toBe(20000);
    // USD view: 10000 + 20000/3.7
    expect(v.usd).toBeCloseTo(10000 + 20000 / 3.7, 6);
    // ILS view: 20000 + 10000×3.7
    expect(v.ils).toBeCloseTo(20000 + 37000, 6);
  });

  it("a stronger USD lifts the ILS view and dents the USD view", () => {
    const weak = portfolioValue({ ...base, fxRate: 3.5 });
    const strong = portfolioValue({ ...base, fxRate: 3.9 });
    expect(strong.ils).toBeGreaterThan(weak.ils); // ILS view rises
    expect(strong.usd).toBeLessThan(weak.usd); // USD view dips
  });

  it("includes net realized and net unrealized P&L", () => {
    const closed = makeTrade({ id: "c", native_currency: "USD", exit_price: 110 }); // net +75
    const open = makeTrade({
      id: "o",
      native_currency: "USD",
      exit_price: null,
      exit_date: null,
      entry_price: 100,
      quantity: 10,
      symbol: "MSFT",
    });
    const v = portfolioValue({
      ...base,
      fxRate: 3.7,
      closedTrades: [closed],
      openTrades: [open],
      quotes: { MSFT: 120 }, // unrealized gross +200 → net 150
    });
    expect(v.nativeUsd).toBeCloseTo(10000 + 75 + 150, 6);
  });
});

// A minimal partial-close factory.
function makeClose(over: Partial<TradeClose> = {}): TradeClose {
  return {
    id: "c1",
    trade_id: "t1",
    user_id: "u1",
    quantity: 5,
    close_price: 110,
    close_date: "2026-01-15",
    commission: 0,
    created_at: "2026-01-15T00:00:00Z",
    ...over,
  };
}

describe("partial closes — remaining quantity & realized net", () => {
  it("closedQuantity / remainingQuantity track tranches", () => {
    const t = makeTrade({ exit_price: null, exit_date: null, quantity: 10 });
    const closes = [makeClose({ quantity: 4 }), makeClose({ id: "c2", quantity: 3 })];
    expect(closedQuantity(closes)).toBe(7);
    expect(remainingQuantity(t, closes)).toBe(3);
    expect(remainingQuantity(t, [])).toBe(10);
  });

  it("realizedNetFromCloses is direction-adjusted and nets commissions", () => {
    const t = makeTrade({ exit_price: null, exit_date: null, entry_price: 100, quantity: 10 });
    // gross 40, net 0.75×40 = 30
    expect(realizedNetFromCloses(t, [makeClose({ quantity: 4, close_price: 110 })])).toBeCloseTo(
      30,
      9
    );
    // short profits when closing BELOW entry
    const short = makeTrade({
      direction: "short",
      exit_price: null,
      exit_date: null,
      entry_price: 100,
      quantity: 10,
    });
    expect(realizedNetFromCloses(short, [makeClose({ quantity: 4, close_price: 90 })])).toBeCloseTo(
      30,
      9
    );
  });

  it("a full close split into tranches equals one close at the weighted average", () => {
    // tranches 4@110 + 6@120 → weighted avg exit 116
    const closes = [
      makeClose({ quantity: 4, close_price: 110 }),
      makeClose({ id: "c2", quantity: 6, close_price: 120 }),
    ];
    const open = makeTrade({ exit_price: null, exit_date: null, entry_price: 100, quantity: 10 });
    const avg = (110 * 4 + 120 * 6) / 10; // 116
    const closedAtAvg = makeTrade({ entry_price: 100, quantity: 10, exit_price: avg });
    expect(realizedNetFromCloses(open, closes)).toBeCloseTo(netPnl(closedAtAvg)!, 9);
    expect(grossPnl(closedAtAvg)).toBeCloseTo(160, 9); // = 40 + 120 from the tranches
  });
});

describe("portfolioValue breakdown — cash + entry cost + live net", () => {
  const base = {
    initialCapitalUsd: 10000,
    initialCapitalIls: 0,
    closedTrades: [] as Trade[],
    fxRate: 3.7,
  };

  it("an open LONG: cost out of cash, into position cost; live net on top", () => {
    const open = makeTrade({
      id: "o",
      exit_price: null,
      exit_date: null,
      entry_price: 100,
      quantity: 10,
      symbol: "MSFT",
    });
    const v = portfolioValue({ ...base, initialCapitalIls: 0, openTrades: [open], quotes: { MSFT: 120 } });
    expect(v.openCostUsd).toBeCloseTo(1000, 6); // 100 × 10, at ENTRY
    expect(v.cashUsd).toBeCloseTo(9000, 6); // 10000 − 1000
    expect(v.openLiveNetUsd).toBeCloseTo(150, 6); // net of +200 gross
    expect(v.nativeUsd).toBeCloseTo(9000 + 1000 + 150, 6);
    // breakdown always sums to the total
    expect(v.cashUsd + v.openCostUsd + v.openLiveNetUsd).toBeCloseTo(v.nativeUsd, 9);
  });

  it("an open SHORT contributes ONLY its live P&L — no cash drain, no position cost", () => {
    const short = makeTrade({
      id: "s",
      direction: "short",
      exit_price: null,
      exit_date: null,
      entry_price: 100,
      quantity: 10,
      symbol: "TSLA",
    });
    const v = portfolioValue({ ...base, openTrades: [short], quotes: { TSLA: 90 } });
    // Borrowed, not bought: the notional never enters the portfolio.
    expect(v.openCostUsd).toBeCloseTo(0, 6);
    expect(v.cashUsd).toBeCloseTo(10000, 6); // cash untouched by the short
    expect(v.openLiveNetUsd).toBeCloseTo(75, 6); // short up: gross +100 → net 75
    expect(v.nativeUsd).toBeCloseTo(10000 + 75, 6); // value = initial + P&L only
  });

  it("a LONG and a SHORT together: only the long's cost is tied up", () => {
    const long = makeTrade({
      id: "l",
      exit_price: null,
      exit_date: null,
      entry_price: 100,
      quantity: 10,
      symbol: "MSFT",
    });
    const short = makeTrade({
      id: "s",
      direction: "short",
      exit_price: null,
      exit_date: null,
      entry_price: 50,
      quantity: 10,
      symbol: "TSLA",
    });
    const v = portfolioValue({
      ...base,
      openTrades: [long, short],
      quotes: { MSFT: 120, TSLA: 40 }, // long +200 gross → 150 net; short +100 gross → 75 net
    });
    expect(v.openCostUsd).toBeCloseTo(1000, 6); // long only (100 × 10); short adds nothing
    expect(v.cashUsd).toBeCloseTo(9000, 6); // 10000 − 1000 long cost; short untouched
    expect(v.openLiveNetUsd).toBeCloseTo(150 + 75, 6);
    expect(v.nativeUsd).toBeCloseTo(9000 + 1000 + 225, 6);
  });

  it("partial closes feed cash live while the position shrinks", () => {
    const open = makeTrade({
      id: "o",
      exit_price: null,
      exit_date: null,
      entry_price: 100,
      quantity: 10,
      symbol: "MSFT",
    });
    const v = portfolioValue({
      ...base,
      openTrades: [open],
      quotes: { MSFT: 120 },
      closesByTrade: { o: [makeClose({ trade_id: "o", quantity: 4, close_price: 110 })] },
    });
    expect(v.openCostUsd).toBeCloseTo(600, 6); // entry × remaining 6
    expect(v.openLiveNetUsd).toBeCloseTo(90, 6); // net of +120 gross on remaining 6
    // cash = 10000 + realized 30 − tied-up 600
    expect(v.cashUsd).toBeCloseTo(9430, 6);
    expect(v.nativeUsd).toBeCloseTo(9430 + 600 + 90, 6);
  });

  it("keeps an open position at entry cost when its live price is missing", () => {
    const open = makeTrade({
      id: "o",
      exit_price: null,
      exit_date: null,
      entry_price: 100,
      quantity: 10,
      symbol: "MSFT",
    });
    const v = portfolioValue({ ...base, openTrades: [open], quotes: {} });
    expect(v.openCostUsd).toBeCloseTo(1000, 6);
    expect(v.openLiveNetUsd).toBeCloseTo(0, 6);
    expect(v.nativeUsd).toBeCloseTo(10000, 6); // included at break-even, not dropped
  });
});
