import type { FxProvider, PriceProvider } from "./types";

// Yahoo Finance — free, NO API key required, near-real-time quotes. The public
// chart endpoint (v8) returns the current market price in `meta.regularMarketPrice`
// and works for equities AND FX pairs (e.g. "USDILS=X").
//
// Hard rule: we NEVER fabricate a value. If Yahoo can't be reached, or returns no
// price, we throw / omit the symbol so the UI shows "missing" — never an invented
// number (this is what replaced the old mock that reported e.g. AMZN = $300).

const CHART_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

// A browser-like User-Agent — Yahoo's public endpoint rejects some bare requests.
const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json",
};

async function fetchYahooPrice(yahooSymbol: string): Promise<number> {
  const url = `${CHART_BASE}/${encodeURIComponent(yahooSymbol)}?interval=1m&range=1d`;
  const res = await fetch(url, {
    headers: HEADERS,
    next: { revalidate: 30 }, // refresh server-side well within the 60s budget
  });
  if (!res.ok) throw new Error(`Yahoo quote failed for ${yahooSymbol}: ${res.status}`);
  const data = (await res.json()) as {
    chart?: { result?: { meta?: { regularMarketPrice?: number } }[] };
  };
  const price = data.chart?.result?.[0]?.meta?.regularMarketPrice;
  if (typeof price !== "number" || !Number.isFinite(price)) {
    throw new Error(`Yahoo: no price for ${yahooSymbol}`);
  }
  return price;
}

// Stooq — free, no key, real (delayed) quotes via CSV. Used as a fallback because
// Yahoo sometimes rate-limits requests coming from cloud/serverless IPs. US
// tickers take a ".us" suffix. Still real data, never invented.
async function fetchStooqPrice(symbol: string): Promise<number> {
  const stooqSym = symbol.includes(".") ? symbol : `${symbol}.us`;
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(
    stooqSym.toLowerCase()
  )}&f=sd2t2ohlcv&h&e=csv`;
  const res = await fetch(url, { next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`Stooq quote failed for ${symbol}: ${res.status}`);
  const csv = await res.text();
  // header line + one data line: Symbol,Date,Time,Open,High,Low,Close,Volume
  const cols = csv.trim().split("\n")[1]?.split(",") ?? [];
  const close = Number(cols[6]);
  if (!Number.isFinite(close) || close <= 0) {
    throw new Error(`Stooq: no price for ${symbol}`);
  }
  return close;
}

async function fetchEquityPrice(symbol: string): Promise<number> {
  try {
    return await fetchYahooPrice(symbol);
  } catch {
    // Fall back to a second real source before giving up. If BOTH fail the
    // symbol is reported as missing — we never substitute a fabricated price.
    return fetchStooqPrice(symbol);
  }
}

export class YahooPriceProvider implements PriceProvider {
  async getQuote(symbol: string): Promise<number> {
    return fetchEquityPrice(symbol.toUpperCase());
  }

  async getQuotes(symbols: string[]): Promise<Record<string, number>> {
    // Per-symbol resilience: one bad ticker must not blank out the rest. Failed
    // symbols are simply OMITTED so the caller reports them as "missing" rather
    // than substituting a made-up price.
    const results = await Promise.allSettled(
      symbols.map(async (s) => {
        const sym = s.toUpperCase();
        return [sym, await fetchEquityPrice(sym)] as const;
      })
    );
    const out: Record<string, number> = {};
    for (const r of results) {
      if (r.status === "fulfilled") out[r.value[0]] = r.value[1];
    }
    return out;
  }
}

export class YahooFxProvider implements FxProvider {
  async getUsdIlsRate(): Promise<number> {
    // "USDILS=X" = how many ILS per 1 USD, intraday & live.
    try {
      return await fetchYahooPrice("USDILS=X");
    } catch {
      // Fallback to Frankfurter (ECB reference rates — real, free, no key). Daily
      // cadence, but a genuine published rate, never an invented one.
      const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=ILS", {
        next: { revalidate: 60 },
      });
      if (!res.ok) throw new Error(`FX fallback failed: ${res.status}`);
      const data = (await res.json()) as { rates?: { ILS?: number } };
      const rate = data.rates?.ILS;
      if (typeof rate !== "number" || !Number.isFinite(rate)) {
        throw new Error("FX fallback: malformed response");
      }
      return rate;
    }
  }
}
