import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeSkins, computePayouts, type SkinsRule } from "@/lib/skins";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", id)
    .single();

  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }

  const { data: allScores } = await supabase
    .from("scores")
    .select("*")
    .eq("tournament_id", id);

  const { data: holes } = await supabase
    .from("course_holes")
    .select("*")
    .eq("tournament_id", id);

  const { data: allPlayers } = await supabase
    .from("tournament_players")
    .select("*")
    .eq("tournament_id", id);

  // Skins is all players who actually played — skip players with less than half the holes scored
  const minHoles = Math.max(1, Math.floor(tournament.num_holes / 2));
  const playerIds = (allPlayers || []).filter((p) => {
    const scoreCount = (allScores || []).filter((s) => s.player_id === p.id).length;
    return scoreCount >= minHoles;
  }).map((p) => p.id);

  const allScoresMapped = (allScores || []).map((s) => ({
    playerId: s.player_id,
    hole: s.hole,
    strokes: s.strokes,
  }));

  const skinsSummary = computeSkins(
    allScoresMapped,
    playerIds,
    tournament.num_holes,
    tournament.unclaimed_rule as "split_among_winners",
    (tournament.skins_rule || "carry_over") as SkinsRule
  );

  // Total pot = buy-in × all players in the tournament
  const totalPotCents = tournament.buy_in_cents * (allPlayers || []).length;

  const payouts = computePayouts(
    skinsSummary.playerSkins,
    totalPotCents,
    skinsSummary.totalSkinsAwarded
  );

  const playerNames: Record<number, string> = {};
  (allPlayers || []).forEach((p) => {
    playerNames[p.id] = p.nickname || p.name;
  });

  return NextResponse.json({
    results: [
      {
        group: { id: -1, name: "All Players" },
        players: (allPlayers || []).map((p) => ({
          id: p.id,
          name: p.name,
          nickname: p.nickname,
          avatarEmoji: p.avatar_emoji,
        })),
        skinsSummary,
        payouts,
        playerNames,
        totalPotCents,
      },
    ],
    courseHoles: holes,
  });
}
