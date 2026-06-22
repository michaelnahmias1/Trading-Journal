import { NextResponse } from "next/server";
import { getFxProvider } from "@/lib/market";
import { createClient } from "@/lib/supabase/server";

// GET /api/fx → { usdIls: 3.7 }  (ILS per 1 USD)
// Separate provider from quotes on purpose, so the portfolio's dual-currency
// display never depends on the equity feed being up.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const usdIls = await getFxProvider().getUsdIlsRate();
    return NextResponse.json({ usdIls });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "fx failed" },
      { status: 502 }
    );
  }
}
