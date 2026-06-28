// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";

// react-dom requires this flag to use act(...) without warnings/throws.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;
import type { Trade } from "@/lib/types";

// Mock the browser supabase client so refetch/delete don't hit the network.
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: [], error: null }),
      }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  }),
}));

// Mock live quotes so no fetch/polling happens.
vi.mock("@/lib/useLiveQuotes", () => ({
  useLiveQuotes: () => ({
    quotes: {},
    fxRate: null,
    fxAsOf: null,
    loading: false,
    error: false,
    missingSymbols: [],
    updatedAt: null,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { TradesClient } from "./TradesClient";

const trade = (over: Partial<Trade> = {}): Trade => ({
  id: "1",
  user_id: "u",
  symbol: "AAPL",
  asset_type: "stock",
  direction: "long",
  native_currency: "USD",
  entry_date: "2026-01-01",
  entry_price: 100,
  quantity: 10,
  exit_date: null,
  exit_price: null,
  commission_per_side: 1,
  stop_loss: null,
  target_price: null,
  strategy_id: null,
  notes: null,
  screenshot_url: null,
  created_at: "",
  updated_at: "",
  ...over,
});

afterEach(() => vi.clearAllMocks());

describe("TradesClient smoke", () => {
  it("renders server-provided rows (incl. position size) and does NOT blank them after mount", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        React.createElement(TradesClient, {
          trades: [trade(), trade({ id: "2", exit_price: 120, exit_date: "2026-02-01" })],
          strategies: [],
          defaultCommission: 1,
          closes: [],
        })
      );
    });

    // Let any post-mount effects settle.
    await act(async () => {
      await Promise.resolve();
    });

    // New "position size" column header (entry price × quantity = 100 × 10).
    expect(container.textContent).toContain("גודל פוזיציה");
    expect(container.textContent).toContain("$1,000.00");

    // Regression guard: the open trade must still be there — the list must not be
    // wiped by a client-side refetch on mount.
    expect(container.textContent).toContain("פתוחות (1)");
    expect(container.textContent).not.toContain("אין עסקאות פתוחות עדיין");

    await act(async () => {
      root.unmount();
    });
  });
});
