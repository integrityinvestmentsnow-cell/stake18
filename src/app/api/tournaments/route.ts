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
