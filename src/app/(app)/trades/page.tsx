import { getProfile, getStrategies, getTradeCloses, getTrades } from "@/lib/data";
import { TradesClient } from "./TradesClient";

export const dynamic = "force-dynamic";

export default async function TradesPage() {
  const [trades, strategies, profile, closes] = await Promise.all([
    getTrades(),
    getStrategies(),
    getProfile(),
    getTradeCloses(),
  ]);

  return (
    <TradesClient
      trades={trades}
      strategies={strategies}
      defaultCommission={profile?.default_commission ?? 0}
      closes={closes}
    />
  );
}
