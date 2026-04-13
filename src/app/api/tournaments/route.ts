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
  await supabase.from("reactions").delete().eq("tournament_id", id);
  await supabase.from("presses").delete().eq("tournament_id", id);
  await supabase.from("scores").delete().eq("tournament_id", id);
  await supabase.from("scorer_groups").delete().eq("tournament_id", id);

  // Delete group_players for all groups in this tournament
  const { data: groups } = await supabase
    .from("groups")
    .select("id")
    .eq("tournament_id", id);
  for (const g of groups || []) {
    await supabase.from("group_players").delete().eq("group_id", g.id);
  }
  await supabase.from("groups").delete().eq("tournament_id", id);

  await supabase.from("tournament_players").delete().eq("tournament_id", id);
  await supabase.from("course_holes").delete().eq("tournament_id", id);
  await supabase.from("event_rsvps").delete().eq("tournament_id", id);
  await supabase.from("player_titles").delete().eq("tournament_id", id);
  await supabase.from("tournaments").delete().eq("id", id);

  return NextResponse.json({ success: true });
}
