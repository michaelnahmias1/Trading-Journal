import type { FxProvider, FxResult } from "./types";

// Dedicated FX provider (exchangerate.host), kept separate from the equity feed
// so the dual-currency portfolio view stays robust if the stock provider is down.
//
// BUDGET: the free tier allows 100 calls/month (~3.3/day).
// revalidate: 28800s (8h) → Next.js serves the cached rate for 8 hours before
// making a new external call, giving ≤3 real API calls per day regardless of
// how often the client polls /api/fx.
const FX_REVALIDATE_SECONDS = 8 * 60 * 60; // 8 hours → ≤3 calls/day

export class ExchangeRateFxProvider implements FxProvider {
  constructor(private readonly apiKey?: string) {}

  async getUsdIlsRate(): Promise<FxResult> {
    const params = new URLSearchParams({ from: "USD", to: "ILS", amount: "1" });
    if (this.apiKey) params.set("access_key", this.apiKey);
    const res = await fetch(`https://api.exchangerate.host/convert?${params.toString()}`, {
      next: { revalidate: FX_REVALIDATE_SECONDS },
    });
    if (!res.ok) throw new Error(`FX rate fetch failed: ${res.status}`);
    const data = (await res.json()) as { result?: number; info?: { timestamp?: number } };
    if (typeof data.result !== "number") throw new Error("FX rate: malformed response");
    // `info.timestamp` (epoch SECONDS) is when the source published the rate.
    const ts = data.info?.timestamp;
    const asOf = typeof ts === "number" ? ts * 1000 : Date.now();
    return { rate: data.result, asOf };
  }
}
