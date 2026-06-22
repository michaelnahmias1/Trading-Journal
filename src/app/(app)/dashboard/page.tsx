import { isClosed } from "@/lib/calculations";
import { getProfile, getTrades } from "@/lib/data";
import { getFxProvider, getPriceProvider, isLiveMarketData } from "@/lib/market";
import type { Profile, QuoteMap } from "@/lib/types";
import { DashboardClient } from "./DashboardClient";

// Quotes + FX are fetched server-side so provider keys never reach the browser.
export const dynamic = "force-dynamic";

const DEFAULT_PROFILE: Omit<Profile, "id"> = {
  initial_capital_usd: 0,
  initial_capital_ils: 0,
  default_commission: 0,
  created_at: "",
  updated_at: "",
};

export default async function DashboardPage() {
  const [trades, profile] = await Promise.all([getTrades(), getProfile()]);

  const openSymbols = Array.from(
    new Set(trades.filter((t) => !isClosed(t)).map((t) => t.symbol.toUpperCase()))
  );

  let quotes: QuoteMap = {};
  let fxRate = 3.7;
  try {
    [quotes, fxRate] = await Promise.all([
      openSymbols.length ? getPriceProvider().getQuotes(openSymbols) : Promise.resolve({}),
      getFxProvider().getUsdIlsRate(),
    ]);
  } catch {
    // Market data is best-effort; the journal still renders without live prices.
  }

  const effectiveProfile: Profile = profile ?? { id: "", ...DEFAULT_PROFILE };

  return (
    <DashboardClient
      trades={trades}
      profile={effectiveProfile}
      quotes={quotes}
      fxRate={fxRate}
      live={isLiveMarketData()}
    />
  );
}
