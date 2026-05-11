import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdminEmail } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: allScores } = await supabase
    .from("scores")
    .select("*")
    .eq("tournament_id", id);

  return NextResponse.json(
    (allScores || []).map((s) => ({
      id: s.id,
      tournamentId: s.tournament_id,
      playerId: s.player_id,
      hole: s.hole,
      strokes: s.strokes,
      updatedAt: s.updated_at,
    }))
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const body = await request.json();
  const { playerId, hole, strokes, scorerId } = body;

  if (!playerId || !hole || !strokes) {
    return NextResponse.json(
      { error: "playerId, hole, and strokes are required" },
      { status: 400 }
    );
  }

  if (hole < 1 || hole > 18 || strokes < 1 || strokes > 15) {
    return NextResponse.json(
      { error: "Invalid hole or strokes value" },
      { status: 400 }
    );
  }

  // Fetch tournament once for both the finalized check and the admin override.
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("status, owner_id")
    .eq("id", id)
    .single();

  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }

  if (tournament.status === "finalized") {
    return NextResponse.json(
      { error: "Tournament is finalized; reopen it to edit scores" },
      { status: 403 }
    );
  }

  // Authorize: scorer assigned to this player, OR tournament owner (admin).
  let authorized = false;

  if (scorerId) {
    // A scorer may have multiple scorer_groups rows if they re-joined or
    // switched groups. The most recent row reflects their current assignment,
    // so we authorize against only that one — taking the union would let
    // someone who switched groups still score their old group's players.
    const { data: sgRows } = await supabase
      .from("scorer_groups")
      .select("player_ids")
      .eq("tournament_id", id)
      .eq("scorer_id", scorerId)
      .order("id", { ascending: false })
      .limit(1);
    const latest = sgRows?.[0];
    if (latest && Array.isArray(latest.player_ids) && latest.player_ids.includes(playerId)) {
      authorized = true;
    }
  }

  if (!authorized) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user && (user.id === tournament.owner_id || isSuperAdminEmail(user.email))) {
      authorized = true;
    }
  }

  if (!authorized) {
    return NextResponse.json(
      { error: "Not authorized to score this player" },
      { status: 403 }
    );
  }

  // Upsert: update if exists, insert if not
  const { data: existing } = await supabase
    .from("scores")
    .select("id")
    .eq("player_id", playerId)
    .eq("hole", hole)
    .limit(1);

  if (existing && existing.length > 0) {
    await supabase
      .from("scores")
      .update({ strokes, updated_at: new Date().toISOString() })
      .eq("player_id", playerId)
      .eq("hole", hole);
  } else {
    await supabase.from("scores").insert({
      tournament_id: id,
      player_id: playerId,
      hole,
      strokes,
    });
  }

  return NextResponse.json({ success: true });
}
