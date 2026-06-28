import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { Profile, Strategy, Trade, TradeClose } from "@/lib/types";

// Server-side data access. RLS guarantees each query only returns the caller's
// rows, so we never filter by user_id here — the database does it.

export async function getTrades(): Promise<Trade[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trades")
    .select("*")
    .order("entry_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Trade[];
}

export async function getTrade(id: string): Promise<Trade | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("trades").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Trade) ?? null;
}

/**
 * Partial-close tranches. RLS scopes rows to the caller. Pass a `tradeId` to
 * fetch one trade's closes (detail page); omit it for all of them (dashboard /
 * trades list, where they're grouped by trade_id on the client).
 */
export async function getTradeCloses(tradeId?: string): Promise<TradeClose[]> {
  const supabase = await createClient();
  let query = supabase
    .from("trade_closes")
    .select("*")
    .order("close_date", { ascending: true });
  if (tradeId) query = query.eq("trade_id", tradeId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as TradeClose[];
}

export async function getStrategies(): Promise<Strategy[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("strategies")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Strategy[];
}

/** The caller's profile, creating a default row if the trigger hasn't yet. */
export async function getProfile(): Promise<Profile | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile) ?? null;
}
