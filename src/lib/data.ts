import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { Profile, Strategy, Trade } from "@/lib/types";

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
