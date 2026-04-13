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

// Create a scorer group (pick players to score for)
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

  const { data: group, error } = await supabase
    .from("scorer_groups")
    .insert({
      tournament_id: tournamentId,
      scorer_id: scorerId,
      player_ids: playerIds,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(group);
}
