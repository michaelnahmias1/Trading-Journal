import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getFxProvider } from "@/lib/market";
import { createClient } from "@/lib/supabase/server";

// GET /api/fx → { usdIls: 3.7, asOf: 1718000000000 }  (ILS per 1 USD + fetch time)
// Separate provider from quotes on purpose, so the portfolio's dual-currency
// display never depends on the equity feed being up.

// BUDGET: the free FX tier allows ~100 calls/month (~3.3/day). We cache BOTH the
// rate and the moment it was actually fetched for 8 hours, giving ≤3 real
// upstream calls per day regardless of how often the client polls /api/fx.
const FX_REVALIDATE_SECONDS = 8 * 60 * 60; // 8 hours → ≤3 calls/day

// Wrapping the whole computation (not just the inner fetch) in unstable_cache is
// what fixes the "time keeps showing now" bug: `fetchedAt` is captured INSIDE the
// cached value, so it only advances when a real upstream refresh happens. While
// the cache is warm the function body never runs, so the timestamp stays put —
// the UI's "last updated" reflects the last actual API call, not the page load.
const getCachedFx = unstable_cache(
  async () => {
    const { rate } = await getFxProvider().getUsdIlsRate();
    return { rate, fetchedAt: Date.now() };
  },
  ["fx-usd-ils-rate"],
  { revalidate: FX_REVALIDATE_SECONDS }
);

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const { rate, fetchedAt } = await getCachedFx();
    return NextResponse.json({ usdIls: rate, asOf: fetchedAt });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "fx failed" },
      { status: 502 }
    );
  }
}
