import { NextResponse } from "next/server";
import { generateTournamentId } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

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
  const { name, date, buyInCents, numHoles, courseHoles: savedHoles, skinsRule, location, isPublic } = body;

  const id = generateTournamentId();
  const holesCount = numHoles || 18;
  const pin = String(Math.floor(1000 + Math.random() * 9000)); // 4-digit PIN

  const { error: tError } = await supabase.from("tournaments").insert({
    id,
    owner_id: user.id,
    name,
    date,
    buy_in_cents: buyInCents || 2000,
    num_holes: holesCount,
    skins_rule: skinsRule || "carry_over",
    pin,
    location: location || null,
    is_public: isPublic !== false,
  });

  if (tError) {
    return NextResponse.json({ error: tError.message }, { status: 500 });
  }

  // Use saved course pars if provided, otherwise default to par 4
  const holes = savedHoles && savedHoles.length > 0
    ? savedHoles.map((h: { hole: number; par: number; hcp?: number }) => ({
        tournament_id: id,
        hole: h.hole,
        par: h.par,
        hcp: h.hcp || null,
      }))
    : Array.from({ length: holesCount }, (_, i) => ({
        tournament_id: id,
        hole: i + 1,
        par: 4,
      }));

  await supabase.from("course_holes").insert(holes);

  return NextResponse.json({ id, name, pin });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // Verify ownership
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("owner_id")
    .eq("id", id)
    .single();

  if (!tournament || tournament.owner_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Delete in order (foreign key dependencies)
  const errors: string[] = [];

  const del = async (table: string, col: string, val: string) => {
    const { error } = await supabase.from(table).delete().eq(col, val);
    if (error) errors.push(`${table}: ${error.message}`);
  };

  await del("reactions", "tournament_id", id);
  await del("presses", "tournament_id", id);
  await del("scores", "tournament_id", id);
  await del("scorer_groups", "tournament_id", id);

  // Delete group_players for all groups in this tournament
  const { data: groups } = await supabase
    .from("groups")
    .select("id")
    .eq("tournament_id", id);
  for (const g of groups || []) {
    await del("group_players", "group_id", String(g.id));
  }
  await del("groups", "tournament_id", id);
  await del("tournament_players", "tournament_id", id);
  await del("course_holes", "tournament_id", id);
  await del("event_rsvps", "tournament_id", id);
  await del("player_titles", "tournament_id", id);

  const { error: finalError } = await supabase.from("tournaments").delete().eq("id", id);
  if (finalError) errors.push(`tournaments: ${finalError.message}`);

  if (errors.length > 0) {
    return NextResponse.json({ error: "Some deletes failed", details: errors }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
