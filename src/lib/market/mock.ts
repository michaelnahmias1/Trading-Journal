import type { FxProvider, PriceProvider } from "./types";

// Deterministic mock data so the whole app runs end-to-end without any external
// account. Prices are derived from the symbol so they're stable per symbol but
// vary between symbols — enough to exercise the unrealized-P&L paths.

function hashSymbol(symbol: string): number {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) % 100000;
  return h;
}

export class MockPriceProvider implements PriceProvider {
  async getQuote(symbol: string): Promise<number> {
    // A plausible price in [20, 520).
    return 20 + (hashSymbol(symbol.toUpperCase()) % 500);
  }

  async getQuotes(symbols: string[]): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const s of symbols) out[s] = await this.getQuote(s);
    return out;
  }
}

export class MockFxProvider implements FxProvider {
  async getUsdIlsRate(): Promise<number> {
    return 3.7; // a steady stand-in for the live USD/ILS rate
  }
}
