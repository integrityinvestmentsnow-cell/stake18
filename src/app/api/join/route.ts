import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Look up tournament by PIN
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pin = searchParams.get("pin");

  if (!pin) {
    return NextResponse.json({ error: "PIN is required" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("*")
    .eq("pin", pin)
    .single();

  if (!tournament) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 404 });
  }

  // Get players
  const { data: players } = await supabase
    .from("tournament_players")
    .select("*")
    .eq("tournament_id", tournament.id);

  return NextResponse.json({
    tournament: {
      id: tournament.id,
      name: tournament.name,
      date: tournament.date,
      buyInCents: tournament.buy_in_cents,
      status: tournament.status,
    },
    players: (players || []).map((p) => ({
      id: p.id,
      name: p.name,
      nickname: p.nickname,
      avatarEmoji: p.avatar_emoji,
    })),
  });
}

// Create a scorer group + skins group from player selection
export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();
  const { tournamentId, playerIds, scorerId } = body;

  if (!tournamentId || !playerIds || playerIds.length === 0 || !scorerId) {
    return NextResponse.json(
      { error: "tournamentId, playerIds, and scorerId are required" },
      { status: 400 }
    );
  }

  // Save scorer group for tracking
  const { data: scorerGroup, error: sgError } = await supabase
    .from("scorer_groups")
    .insert({
      tournament_id: tournamentId,
      scorer_id: scorerId,
      player_ids: playerIds,
    })
    .select()
    .single();

  if (sgError) {
    return NextResponse.json({ error: sgError.message }, { status: 500 });
  }

  // Create a skins group with these players
  // Count existing groups to auto-name
  const { count } = await supabase
    .from("groups")
    .select("*", { count: "exact", head: true })
    .eq("tournament_id", tournamentId);

  const groupName = `Group ${(count || 0) + 1}`;

  const { data: skinsGroup, error: gError } = await supabase
    .from("groups")
    .insert({ tournament_id: tournamentId, name: groupName })
    .select()
    .single();

  if (gError) {
    return NextResponse.json({ error: gError.message }, { status: 500 });
  }

  // Add players to the skins group
  await supabase.from("group_players").insert(
    playerIds.map((playerId: number) => ({
      group_id: skinsGroup.id,
      player_id: playerId,
    }))
  );

  return NextResponse.json({
    id: scorerGroup.id,
    groupId: skinsGroup.id,
    groupName,
  });
}

// Update a scorer's group (swap players)
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const body = await request.json();
  const { scorerGroupId, groupId, playerIds } = body;

  if (!groupId || !playerIds || playerIds.length === 0) {
    return NextResponse.json(
      { error: "groupId and playerIds are required" },
      { status: 400 }
    );
  }

  // Update scorer group
  if (scorerGroupId) {
    await supabase
      .from("scorer_groups")
      .update({ player_ids: playerIds })
      .eq("id", scorerGroupId);
  }

  // Clear existing players from skins group and re-add
  await supabase
    .from("group_players")
    .delete()
    .eq("group_id", groupId);

  await supabase.from("group_players").insert(
    playerIds.map((playerId: number) => ({
      group_id: groupId,
      player_id: playerId,
    }))
  );

  return NextResponse.json({ success: true });
}
