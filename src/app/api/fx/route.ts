import { NextResponse } from "next/server";
import { getFxProvider } from "@/lib/market";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// GET /api/fx → { usdIls: 3.7, asOf: 1718000000000 }  (ILS per 1 USD + fetch time)
// Separate provider from quotes on purpose, so the portfolio's dual-currency
// display never depends on the equity feed being up.

// BUDGET: the free exchangerate tier allows ~100 calls/month (~3.3/day). The
// real upstream call happens at most once per 8h WINDOW, shared across every
// serverless instance via a row in the database (an in-memory cache can't do
// this — each cold start / parallel instance has its own memory and would call
// again, which is how dozens of calls/day were happening).
const FX_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours → ≤3 calls/day
const CACHE_KEY = "fx_usd_ils";

type FxPayload = { rate: number; fetchedAt: number };

// Per-instance short-circuit so the 30s client polls don't even touch the DB
// while a value is fresh. The DB row remains the cross-instance source of truth.
let mem: FxPayload | null = null;

function ok(p: FxPayload) {
  return NextResponse.json({ usdIls: p.rate, asOf: p.fetchedAt });
}

// Fetch the real rate, persist it (so every other instance reuses it), update
// the local memo, and return it.
async function refreshAndStore(supabase: SupabaseClient): Promise<FxPayload> {
  const { rate } = await getFxProvider().getUsdIlsRate();
  const payload: FxPayload = { rate, fetchedAt: Date.now() };
  await supabase
    .from("app_cache")
    .upsert({
      key: CACHE_KEY,
      payload,
      updated_at: new Date(payload.fetchedAt).toISOString(),
    })
    .throwOnError();
  mem = payload;
  return payload;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const now = Date.now();

  // 1. Fresh in this instance's memory → return immediately, no DB, no API.
  if (mem && now - mem.fetchedAt < FX_TTL_MS) return ok(mem);

  try {
    // 2. Consult the shared DB cache.
    const { data: row, error: readErr } = await supabase
      .from("app_cache")
      .select("payload, updated_at")
      .eq("key", CACHE_KEY)
      .maybeSingle();
    if (readErr) throw readErr;

    const cached = (row?.payload as FxPayload | undefined) ?? undefined;
    const cachedValid = !!cached && typeof cached.rate === "number";
    const rowAgeMs = row ? now - new Date(row.updated_at).getTime() : Infinity;

    if (cachedValid && rowAgeMs < FX_TTL_MS) {
      mem = cached!;
      return ok(cached!);
    }

    // 3. Stale/missing → exactly ONE caller does the real fetch. The conditional
    //    update is atomic: of N concurrent callers only the first flips
    //    updated_at past the stale threshold, so only it calls the provider.
    const staleBefore = new Date(now - FX_TTL_MS).toISOString();
    let won: boolean;
    if (!row) {
      // First ever: insert a claim row; a losing concurrent insert hits the PK.
      const { error: insErr } = await supabase
        .from("app_cache")
        .insert({ key: CACHE_KEY, payload: cached ?? {}, updated_at: new Date(now).toISOString() });
      won = !insErr;
    } else {
      const { data: claimed } = await supabase
        .from("app_cache")
        .update({ updated_at: new Date(now).toISOString() })
        .eq("key", CACHE_KEY)
        .lt("updated_at", staleBefore)
        .select("key");
      won = !!claimed?.length;
    }

    if (won) {
      try {
        return ok(await refreshAndStore(supabase));
      } catch (e) {
        // The real fetch failed AFTER we claimed the refresh. Release the claim
        // by back-dating updated_at so another instance can retry right away,
        // instead of the rate being locked out (and shown as unavailable) for
        // the whole 8h window.
        await supabase
          .from("app_cache")
          .update({ updated_at: new Date(now - FX_TTL_MS - 1000).toISOString() })
          .eq("key", CACHE_KEY)
          .then(
            () => {},
            () => {}
          );
        throw e;
      }
    }

    // 4. Someone else is refreshing. Re-read for their fresh value; otherwise
    //    serve the stale one rather than spending another API call.
    const { data: latest } = await supabase
      .from("app_cache")
      .select("payload")
      .eq("key", CACHE_KEY)
      .maybeSingle();
    const p = (latest?.payload as FxPayload | undefined) ?? cached;
    if (p && typeof p.rate === "number") {
      mem = p;
      return ok(p);
    }
    // Nothing usable cached at all → fall back to a direct fetch.
    return ok(await refreshAndStore(supabase));
  } catch (e) {
    // DB cache unavailable (e.g. migration not applied yet) or fetch failed.
    // Serve the last in-memory value if we have one; else try a direct fetch.
    if (mem) return ok(mem);
    try {
      const { rate } = await getFxProvider().getUsdIlsRate();
      mem = { rate, fetchedAt: Date.now() };
      return ok(mem);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "fx failed" },
        { status: 502 }
      );
    }
  }
}
