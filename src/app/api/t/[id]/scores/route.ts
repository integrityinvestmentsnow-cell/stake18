import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
  const { playerId, hole, strokes } = body;

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
