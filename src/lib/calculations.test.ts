import { describe, expect, it } from "vitest";
import {
  computeStats,
  equityCurve,
  filterClosedByTimeframe,
  grossPnl,
  netFromGross,
  netPnl,
  portfolioValue,
  rMultiple,
  taxAmount,
  taxableBase,
  taxBalance,
} from "./calculations";
import type { Trade } from "./types";

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
