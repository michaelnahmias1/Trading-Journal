"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser Supabase client. Uses the anon key — all data access is protected by
// Row-Level Security, so this is safe to ship to the browser.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
