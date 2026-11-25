import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// Public, aggregate-only stats for the landing page.
// Service-role client because we're reading across all tournaments regardless
// of owner; only counts/sums leave the server, no PII.
// Revalidated every 60s — fresh enough to feel live, cheap enough on free tier.
export const revalidate = 60;

export async function GET() {
  const supabase = createServiceClient();

  const [
    tournamentsRes,
    scoresRes,
    tpRes,
    scorePairsRes,
    buyInsRes,
  ] = await Promise.all([
    supabase.from("tournaments").select("*", { count: "exact", head: true }),
    supabase.from("scores").select("*", { count: "exact", head: true }),
    supabase
      .from("tournament_players")
      .select("roster_player_id, tournament_id")
      .limit(50000),
    supabase.from("scores").select("player_id, tournament_id").limit(50000),
    supabase.from("tournaments").select("id, buy_in_cents").limit(5000),
  ]);

  const golfers = new Set<number>();
  const playerCountByTournament = new Map<string, number>();
  for (const row of tpRes.data || []) {
    if (row.roster_player_id != null) golfers.add(row.roster_player_id);
    playerCountByTournament.set(
      row.tournament_id,
      (playerCountByTournament.get(row.tournament_id) || 0) + 1
    );
  }

  const rounds = new Set<string>();
  for (const row of scorePairsRes.data || []) {
    rounds.add(`${row.tournament_id}:${row.player_id}`);
  }

  let moneyMovedCents = 0;
  for (const t of buyInsRes.data || []) {
    const n = playerCountByTournament.get(t.id) || 0;
    moneyMovedCents += (t.buy_in_cents || 0) * n;
  }

  return NextResponse.json({
    tournaments: tournamentsRes.count ?? 0,
    scores: scoresRes.count ?? 0,
    golfers: golfers.size,
    rounds: rounds.size,
    moneyMovedCents,
  });
}
