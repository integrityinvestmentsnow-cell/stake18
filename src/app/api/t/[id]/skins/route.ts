import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeSkins, computePayouts, type SkinsRule } from "@/lib/skins";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const url = new URL(request.url);
  const groupId = url.searchParams.get("groupId");

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", id)
    .single();

  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }

  const { data: tournamentGroups } = groupId
    ? await supabase.from("groups").select("*").eq("id", Number(groupId))
    : await supabase.from("groups").select("*").eq("tournament_id", id);

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

  const results = [];

  for (const group of tournamentGroups || []) {
    const { data: gp } = await supabase
      .from("group_players")
      .select("*")
      .eq("group_id", group.id);

    const playerIds = (gp || []).map((p) => p.player_id);
    const groupPlayerData = (allPlayers || []).filter((p) =>
      playerIds.includes(p.id)
    );

    const groupScores = (allScores || [])
      .filter((s) => playerIds.includes(s.player_id))
      .map((s) => ({
        playerId: s.player_id,
        hole: s.hole,
        strokes: s.strokes,
      }));

    const skinsSummary = computeSkins(
      groupScores,
      playerIds,
      tournament.num_holes,
      tournament.unclaimed_rule as "split_among_winners",
      (tournament.skins_rule || "carry_over") as SkinsRule
    );

    const totalPotCents = tournament.buy_in_cents * groupPlayerData.length;
    const payouts = computePayouts(
      skinsSummary.playerSkins,
      totalPotCents,
      skinsSummary.totalSkinsAwarded
    );

    const playerNames: Record<number, string> = {};
    groupPlayerData.forEach((p) => {
      playerNames[p.id] = p.nickname || p.name;
    });

    results.push({
      group: { id: group.id, name: group.name },
      players: groupPlayerData.map((p) => ({
        id: p.id,
        name: p.name,
        nickname: p.nickname,
        avatarEmoji: p.avatar_emoji,
      })),
      skinsSummary,
      payouts,
      playerNames,
      totalPotCents,
    });
  }

  return NextResponse.json({
    results,
    courseHoles: holes,
  });
}
