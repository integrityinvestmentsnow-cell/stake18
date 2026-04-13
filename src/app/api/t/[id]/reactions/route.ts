import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: allReactions } = await supabase
    .from("reactions")
    .select("*")
    .eq("tournament_id", id);

  return NextResponse.json(allReactions);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const body = await request.json();
  const { playerId, hole, emoji } = body;

  if (playerId === undefined || playerId === null || !hole || !emoji) {
    return NextResponse.json(
      { error: "playerId, hole, and emoji are required" },
      { status: 400 }
    );
  }

  const { data: reaction, error } = await supabase
    .from("reactions")
    .insert({
      tournament_id: id,
      player_id: playerId,
      hole,
      emoji,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(reaction);
}
