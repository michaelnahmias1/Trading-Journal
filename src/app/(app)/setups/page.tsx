import { getStrategies, getTrades } from "@/lib/data";
import { SetupsClient } from "./SetupsClient";

export const dynamic = "force-dynamic";

export default async function SetupsPage() {
  const [trades, strategies] = await Promise.all([getTrades(), getStrategies()]);
  return <SetupsClient trades={trades} strategies={strategies} />;
}
