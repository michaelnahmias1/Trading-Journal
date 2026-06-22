import { getProfile, getStrategies, getTrades } from "@/lib/data";
import { TradesClient } from "./TradesClient";

export const dynamic = "force-dynamic";

export default async function TradesPage() {
  const [trades, strategies, profile] = await Promise.all([
    getTrades(),
    getStrategies(),
    getProfile(),
  ]);

  return (
    <TradesClient
      trades={trades}
      strategies={strategies}
      defaultCommission={profile?.default_commission ?? 0}
    />
  );
}
