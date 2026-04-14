import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  const { data: players } = await supabase
    .from("tournament_players")
    .select("*")
    .eq("tournament_id", id);

  const { data: tournamentGroups } = await supabase
    .from("groups")
    .select("*")
    .eq("tournament_id", id);

  const allGroupPlayers = [];
  for (const group of tournamentGroups || []) {
    const { data: gp } = await supabase
      .from("group_players")
      .select("*")
      .eq("group_id", group.id);
    allGroupPlayers.push(
      ...(gp || []).map((p) => ({
        groupId: p.group_id,
        playerId: p.player_id,
        groupName: group.name,
      }))
    );
  }

  const { data: holes } = await supabase
    .from("course_holes")
    .select("*")
    .eq("tournament_id", id);

  return NextResponse.json({
    tournament: {
      id: tournament.id,
      ownerId: tournament.owner_id,
      name: tournament.name,
      date: tournament.date,
      buyInCents: tournament.buy_in_cents,
      numHoles: tournament.num_holes,
      unclaimedRule: tournament.unclaimed_rule,
      skinsRule: tournament.skins_rule || "carry_over",
      pin: tournament.pin || null,
      status: tournament.status,
      leaderboardStyle: tournament.leaderboard_style || "modern",
      createdAt: tournament.created_at,
    },
    players: (players || []).map((p) => ({
      id: p.id,
      tournamentId: p.tournament_id,
      rosterPlayerId: p.roster_player_id,
      name: p.name,
      nickname: p.nickname,
      handicap: p.handicap,
      avatarEmoji: p.avatar_emoji,
    })),
    groups: (tournamentGroups || []).map((g) => ({
      id: g.id,
      tournamentId: g.tournament_id,
      name: g.name,
    })),
    groupPlayers: allGroupPlayers,
    courseHoles: (holes || []).map((h) => ({
      id: h.id,
      tournamentId: h.tournament_id,
      hole: h.hole,
      par: h.par,
      hcp: h.hcp || null,
    })),
  });
}
