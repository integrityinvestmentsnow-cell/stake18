import HomeClient from "./HomeClient";
import { getLiveStats } from "@/lib/stats";

// Server component so the live-stats numbers are baked into the first HTML
// paint — no "—" placeholders flashing while JS loads, and crawlers/Open
// Graph previews see the real totals too. Revalidated every 60 seconds so a
// page refresh after new rounds come in picks up the newer numbers without
// a rebuild.
export const revalidate = 60;

export default async function Home() {
  const stats = await getLiveStats();
  return <HomeClient initialStats={stats} />;
}
