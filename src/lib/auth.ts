// Server-only auth helpers. These functions never run on the client — they
// rely on Supabase Auth's request-cookie session, which doesn't exist in the
// browser bundle.

import type { createClient } from "@/lib/supabase/server";

// Super-admins can act as the owner of ANY tournament. Use sparingly.
// Hard-coded list, not a DB lookup — avoids any path where this becomes
// editable via the app's own admin surface.
const SUPER_ADMIN_EMAILS = new Set<string>([
  "mike@highergroundnomad.com",
]);

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.has(email.toLowerCase());
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Returns true if the authenticated user is the tournament owner OR a
// super-admin. Returns false for unauthenticated requests or unrelated users.
export async function isAdminForTournament(
  supabase: SupabaseServerClient,
  tournamentId: string
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  if (isSuperAdminEmail(user.email)) return true;

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("owner_id")
    .eq("id", tournamentId)
    .single();
  return tournament?.owner_id === user.id;
}

// Returns the current user if super-admin, else null. Useful for
// short-circuiting "do I need to filter by owner?" queries.
export async function getSuperAdmin(
  supabase: SupabaseServerClient
): Promise<{ id: string; email: string } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return null;
  return isSuperAdminEmail(user.email) ? { id: user.id, email: user.email } : null;
}
