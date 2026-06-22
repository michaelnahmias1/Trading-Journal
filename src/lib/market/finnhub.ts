import type { PriceProvider } from "./types";

// Finnhub equity quotes. Free tier (60 req/min, ~15-min delayed) is plenty for a
// journal — we only need current prices for open positions, never streaming.
// Also covers crypto/FX in the future, keeping that a one-integration extension.
export class FinnhubPriceProvider implements PriceProvider {
  constructor(private readonly apiKey: string) {}

  async getQuote(symbol: string): Promise<number> {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(
      symbol.toUpperCase()
    )}&token=${this.apiKey}`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) throw new Error(`Finnhub quote failed for ${symbol}: ${res.status}`);
    const data = (await res.json()) as { c?: number };
    if (typeof data.c !== "number") throw new Error(`Finnhub: no price for ${symbol}`);
    return data.c; // `c` = current price
  }

  async getQuotes(symbols: string[]): Promise<Record<string, number>> {
    const entries = await Promise.all(
      symbols.map(async (s) => [s, await this.getQuote(s)] as const)
    );
    return Object.fromEntries(entries);
  }
}
