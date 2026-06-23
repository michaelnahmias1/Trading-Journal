// ── Market data boundary ─────────────────────────────────────────────────────
// Two SEPARATE providers, on purpose:
//   • PriceProvider — equities (and, later, crypto/FX) via Finnhub.
//   • FxProvider    — USD/ILS, on a dedicated FX API, isolated so the
//                     dual-currency portfolio never depends on the equity feed.
//
// Everything behind this interface is swappable. Until API keys are supplied a
// deterministic mock implementation is used. These run SERVER-SIDE ONLY.

export interface PriceProvider {
  /** Current price for a symbol, in the symbol's native currency. */
  getQuote(symbol: string): Promise<number>;
  /** Batched convenience — defaults to sequential getQuote calls. */
  getQuotes(symbols: string[]): Promise<Record<string, number>>;
}

/** A USD/ILS rate together with the moment it was published by the source. */
export interface FxResult {
  /** How many ILS per 1 USD. */
  rate: number;
  /** Epoch ms when the source last published this rate (best effort). */
  asOf: number;
}

export interface FxProvider {
  /** USD/ILS rate (ILS per 1 USD) plus when the source last refreshed it. */
  getUsdIlsRate(): Promise<FxResult>;
}
