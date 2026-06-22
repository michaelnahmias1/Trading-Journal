import { getProfile, getTrades } from "@/lib/data";
import { isLiveMarketData } from "@/lib/market";
import type { Profile } from "@/lib/types";
import { DashboardClient } from "./DashboardClient";

// Only the DB reads happen server-side now — they're fast. Live quotes + FX are
// fetched in the browser after first paint so navigation is never blocked on an
// external market API.
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
  const effectiveProfile: Profile = profile ?? { id: "", ...DEFAULT_PROFILE };

  return (
    <DashboardClient trades={trades} profile={effectiveProfile} live={isLiveMarketData()} />
  );
}
