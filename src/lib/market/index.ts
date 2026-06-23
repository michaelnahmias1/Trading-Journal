// Provider selection — the single place that decides which live source to use.
// Keys live only in server env (never NEXT_PUBLIC), so this module must only be
// imported from server code (route handlers, server components).
//
// IMPORTANT: there is no longer a "mock" fallback. We always use a real source
// (Yahoo needs no key), and when a source is unreachable we surface an error
// upstream rather than fabricate a price.

import { ExchangeRateFxProvider } from "./exchangerate";
import { FinnhubPriceProvider } from "./finnhub";
import { YahooFxProvider, YahooPriceProvider } from "./yahoo";
import type { FxProvider, PriceProvider } from "./types";

export function getPriceProvider(): PriceProvider {
  const key = process.env.FINNHUB_API_KEY;
  // Prefer Finnhub when a key is configured; otherwise Yahoo (free, no key).
  return key ? new FinnhubPriceProvider(key) : new YahooPriceProvider();
}

export function getFxProvider(): FxProvider {
  // Prefer exchangerate.host when a key is configured; otherwise Yahoo gives a
  // live, intraday USD/ILS rate with no key (and falls back to ECB rates).
  if (process.env.EXCHANGERATE_API_KEY) {
    return new ExchangeRateFxProvider(process.env.EXCHANGERATE_API_KEY);
  }
  return new YahooFxProvider();
}

export type { FxProvider, PriceProvider };
