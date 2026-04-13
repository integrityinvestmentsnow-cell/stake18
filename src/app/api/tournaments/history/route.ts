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

  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("id, name, date, status, buy_in_cents, pin, num_holes")
    .eq("owner_id", user.id)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  const results = [];
  for (const t of tournaments || []) {
    const { count } = await supabase
      .from("tournament_players")
      .select("*", { count: "exact", head: true })
      .eq("tournament_id", t.id);

    results.push({
      id: t.id,
      name: t.name,
      date: t.date,
      status: t.status,
      buyInCents: t.buy_in_cents,
      pin: t.pin,
      playerCount: count || 0,
    });
  }

  return NextResponse.json(results);
}
