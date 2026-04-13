import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: players, error } = await supabase
    .from("roster_players")
    .select("*")
    .eq("owner_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Map snake_case columns to camelCase for frontend compatibility
  const mapped = (players || []).map((p) => ({
    id: p.id,
    ownerId: p.owner_id,
    name: p.name,
    nickname: p.nickname,
    email: p.email,
    handicap: p.handicap,
    avatarEmoji: p.avatar_emoji,
    claimedBy: p.claimed_by,
    createdAt: p.created_at,
  }));

  return NextResponse.json(mapped);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Ensure account exists
  const { data: existing } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", user.id)
    .limit(1);

  if (!existing || existing.length === 0) {
    await supabase.from("accounts").insert({
      id: user.id,
      email: user.email || "",
      display_name:
        user.user_metadata?.full_name || user.email || "Organizer",
    });
  }

  const body = await request.json();
  const { name, nickname, email, handicap, avatarEmoji } = body;

  const { data: player, error } = await supabase
    .from("roster_players")
    .insert({
      owner_id: user.id,
      name,
      nickname: nickname || null,
      email: email || null,
      handicap: handicap || 0,
      avatar_emoji: avatarEmoji || "🏌️",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    id: player.id,
    ownerId: player.owner_id,
    name: player.name,
    nickname: player.nickname,
    email: player.email,
    handicap: player.handicap,
    avatarEmoji: player.avatar_emoji,
    claimedBy: player.claimed_by,
    createdAt: player.created_at,
  });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, name, nickname, email, handicap, avatarEmoji } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { data: player, error } = await supabase
    .from("roster_players")
    .update({
      name,
      nickname: nickname || null,
      email: email || null,
      handicap: handicap || 0,
      avatar_emoji: avatarEmoji || "🏌️",
    })
    .eq("id", id)
    .eq("owner_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    id: player.id,
    ownerId: player.owner_id,
    name: player.name,
    nickname: player.nickname,
    email: player.email,
    handicap: player.handicap,
    avatarEmoji: player.avatar_emoji,
    claimedBy: player.claimed_by,
    createdAt: player.created_at,
  });
}
