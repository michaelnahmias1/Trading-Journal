import { NextResponse } from "next/server";
import { getFxProvider } from "@/lib/market";
import { createClient } from "@/lib/supabase/server";

// GET /api/fx → { usdIls: 3.7, asOf: 1718000000000 }  (ILS per 1 USD + fetch time)
// Separate provider from quotes on purpose, so the portfolio's dual-currency
// display never depends on the equity feed being up.

// BUDGET: the free FX tier allows ~100 calls/month (~3.3/day). We memoise the
// rate together with the moment it was actually fetched for 8 hours, so:
//   • at most ~3 real upstream calls per day no matter how often clients poll;
//   • `asOf` is the time of that last real call — NOT the page-load time, which
//     was the bug (the old code recomputed Date.now() on every request).
const FX_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours → ≤3 calls/day

let cached: { rate: number; fetchedAt: number } | null = null;

async function getFxRate(): Promise<{ rate: number; fetchedAt: number }> {
  if (cached && Date.now() - cached.fetchedAt < FX_TTL_MS) return cached;
  const { rate } = await getFxProvider().getUsdIlsRate();
  cached = { rate, fetchedAt: Date.now() };
  return cached;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const { rate, fetchedAt } = await getFxRate();
    return NextResponse.json({ usdIls: rate, asOf: fetchedAt });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "fx failed" },
      { status: 502 }
    );
  }
}
