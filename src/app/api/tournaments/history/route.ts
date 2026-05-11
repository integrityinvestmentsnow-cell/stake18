import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdminEmail } from "@/lib/auth";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Super-admins see every active tournament; everyone else sees their own.
  const superAdmin = isSuperAdminEmail(user.email);
  let query = supabase
    .from("tournaments")
    .select("id, name, date, status, buy_in_cents, pin, num_holes, owner_id")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (!superAdmin) {
    query = query.eq("owner_id", user.id);
  }
  const { data: tournaments } = await query;

  // If super-admin is viewing, fetch owner display names so the UI can label
  // whose tournament is whose. Cheap enough to do for everyone — same query
  // shape regardless of who's calling.
  const ownerIds = Array.from(new Set((tournaments || []).map((t) => t.owner_id)));
  const { data: owners } = ownerIds.length
    ? await supabase
        .from("accounts")
        .select("id, display_name, email")
        .in("id", ownerIds)
    : { data: [] };
  const ownerById: Record<string, { displayName: string; email: string }> = {};
  for (const o of owners || []) {
    ownerById[o.id] = { displayName: o.display_name || o.email || "Unknown", email: o.email || "" };
  }

  const results = [];
  for (const t of tournaments || []) {
    const { count } = await supabase
      .from("tournament_players")
      .select("*", { count: "exact", head: true })
      .eq("tournament_id", t.id);

    const owner = ownerById[t.owner_id];
    results.push({
      id: t.id,
      name: t.name,
      date: t.date,
      status: t.status,
      buyInCents: t.buy_in_cents,
      pin: t.pin,
      playerCount: count || 0,
      ownerId: t.owner_id,
      ownerName: owner?.displayName || null,
      isOwn: t.owner_id === user.id,
    });
  }

  return NextResponse.json(results);
}
