import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeSkins, computePayouts, type SkinsRule } from "@/lib/skins";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const rosterPlayerId = searchParams.get("id");

  if (!rosterPlayerId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // Get all tournament_players linked to this roster player
  const { data: tournamentPlayers } = await supabase
    .from("tournament_players")
    .select("id, tournament_id")
    .eq("roster_player_id", Number(rosterPlayerId));

  if (!tournamentPlayers || tournamentPlayers.length === 0) {
    return NextResponse.json({ rounds: 0, totalSkins: 0, totalEarnings: 0 });
  }

  const tournamentIds = [...new Set(tournamentPlayers.map((tp) => tp.tournament_id))];

  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("id, buy_in_cents, num_holes, skins_rule")
    .in("id", tournamentIds);

  let totalSkins = 0;
  let totalEarnings = 0;

  for (const tournamentId of tournamentIds) {
    const tournament = (tournaments || []).find((t) => t.id === tournamentId);
    if (!tournament) continue;

    const tp = tournamentPlayers.find((p) => p.tournament_id === tournamentId);
    if (!tp) continue;

    const { data: allTournamentPlayers } = await supabase
      .from("tournament_players")
      .select("id")
      .eq("tournament_id", tournamentId);

    const allPlayerIds = (allTournamentPlayers || []).map((p) => p.id);

    const { data: tournamentScores } = await supabase
      .from("scores")
      .select("player_id, hole, strokes")
      .eq("tournament_id", tournamentId);

    const scoresMapped = (tournamentScores || []).map((s) => ({
      playerId: s.player_id,
      hole: s.hole,
      strokes: s.strokes,
    }));

    const skinsSummary = computeSkins(
      scoresMapped,
      allPlayerIds,
      tournament.num_holes,
      "split_among_winners",
      (tournament.skins_rule || "carry_over") as SkinsRule
    );

    const totalPotCents = tournament.buy_in_cents * allPlayerIds.length;
    const payouts = computePayouts(skinsSummary.playerSkins, totalPotCents, skinsSummary.totalSkinsAwarded);

    totalSkins += skinsSummary.playerSkins[tp.id] || 0;
    totalEarnings += payouts[tp.id] || 0;
  }

  return NextResponse.json({
    rounds: tournamentIds.length,
    totalSkins,
    totalEarnings,
  });
}
