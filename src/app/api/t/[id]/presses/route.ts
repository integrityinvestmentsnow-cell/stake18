import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: allPresses } = await supabase
    .from("presses")
    .select("*")
    .eq("tournament_id", id);

  return NextResponse.json(allPresses);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const body = await request.json();
  const { groupId, fromPlayerId, toPlayerId, hole, multiplier } = body;

  if (!groupId || !fromPlayerId || !toPlayerId || !hole) {
    return NextResponse.json(
      { error: "groupId, fromPlayerId, toPlayerId, and hole are required" },
      { status: 400 }
    );
  }

  const { data: press, error } = await supabase
    .from("presses")
    .insert({
      tournament_id: id,
      group_id: groupId,
      from_player_id: fromPlayerId,
      to_player_id: toPlayerId,
      hole,
      multiplier: multiplier || 2,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(press);
}
