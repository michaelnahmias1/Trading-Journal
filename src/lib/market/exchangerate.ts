import type { FxProvider } from "./types";

// Dedicated FX provider (exchangerate.host), kept separate from the equity feed
// so the dual-currency portfolio view stays robust if the stock provider is down.
export class ExchangeRateFxProvider implements FxProvider {
  constructor(private readonly apiKey?: string) {}

  async getUsdIlsRate(): Promise<number> {
    const params = new URLSearchParams({ from: "USD", to: "ILS", amount: "1" });
    if (this.apiKey) params.set("access_key", this.apiKey);
    const res = await fetch(`https://api.exchangerate.host/convert?${params.toString()}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`FX rate fetch failed: ${res.status}`);
    const data = (await res.json()) as { result?: number };
    if (typeof data.result !== "number") throw new Error("FX rate: malformed response");
    return data.result;
  }
}
