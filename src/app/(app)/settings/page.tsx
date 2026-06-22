import { getProfile, getStrategies } from "@/lib/data";
import { SettingsClient } from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [profile, strategies] = await Promise.all([getProfile(), getStrategies()]);
  return <SettingsClient profile={profile} strategies={strategies} />;
}
