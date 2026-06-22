// Provider selection — the single place that decides mock vs. live. Keys live
// only in server env (never NEXT_PUBLIC), so this module must only be imported
// from server code (route handlers, server components).

import { ExchangeRateFxProvider } from "./exchangerate";
import { FinnhubPriceProvider } from "./finnhub";
import { MockFxProvider, MockPriceProvider } from "./mock";
import type { FxProvider, PriceProvider } from "./types";

export function getPriceProvider(): PriceProvider {
  const key = process.env.FINNHUB_API_KEY;
  return key ? new FinnhubPriceProvider(key) : new MockPriceProvider();
}

export function getFxProvider(): FxProvider {
  // exchangerate.host has a free no-key tier; the access key is optional.
  if (process.env.FINNHUB_API_KEY || process.env.EXCHANGERATE_API_KEY) {
    return new ExchangeRateFxProvider(process.env.EXCHANGERATE_API_KEY);
  }
  return new MockFxProvider();
}

/** True when live market data is wired up (vs. mock stand-ins). */
export function isLiveMarketData(): boolean {
  return Boolean(process.env.FINNHUB_API_KEY);
}

export type { FxProvider, PriceProvider };
