import { NextResponse } from "next/server";
import { getPriceProvider } from "@/lib/market";
import { createClient } from "@/lib/supabase/server";

// GET /api/quote?symbols=AAPL,MSFT  → { quotes: { AAPL: 123.4, ... }, live: bool }
// Keys stay server-side; the browser never sees the market providers.
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const symbols = (searchParams.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  if (symbols.length === 0) return NextResponse.json({ quotes: {} });

  try {
    const quotes = await getPriceProvider().getQuotes(symbols);
    return NextResponse.json({ quotes });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "quote failed" },
      { status: 502 }
    );
  }
}
