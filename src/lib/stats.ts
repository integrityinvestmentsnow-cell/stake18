// Aggregate stats used by the landing page (server-rendered) and by the
// /api/stats JSON endpoint (client-side refresh, debugging).
//
// Service-role client because we read across every owner's tournaments; only
// counts and sums leave this function, no PII.

import { createServiceClient } from "@/lib/supabase/service";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface LiveStats {
  tournaments: number;
  scores: number;
  golfers: number;
  rounds: number;
  moneyMovedCents: number;
}

// Supabase caps any single REST read at max_rows (default 1000) regardless of
// .limit(), so everything that could exceed 1000 rows gets pulled in pages.
const PAGE = 1000;
async function fetchAll<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const batch = (data || []) as T[];
    out.push(...batch);
    if (batch.length < PAGE) break;
  }
  return out;
}

export async function getLiveStats(): Promise<LiveStats> {
  const supabase = createServiceClient();

  const [tournamentsCount, scoresCount, tpRows, scorePairs, buyInRows] =
    await Promise.all([
      supabase
        .from("tournaments")
        .select("*", { count: "exact", head: true })
        .then((r) => r.count ?? 0),
      supabase
        .from("scores")
        .select("*", { count: "exact", head: true })
        .then((r) => r.count ?? 0),
      fetchAll<{ roster_player_id: number | null; tournament_id: string }>(
        supabase,
        "tournament_players",
        "roster_player_id, tournament_id"
      ),
      fetchAll<{ player_id: string; tournament_id: string }>(
        supabase,
        "scores",
        "player_id, tournament_id"
      ),
      fetchAll<{ id: string; buy_in_cents: number }>(
        supabase,
        "tournaments",
        "id, buy_in_cents"
      ),
    ]);

  const golfers = new Set<number>();
  const playerCountByTournament = new Map<string, number>();
  for (const row of tpRows) {
    if (row.roster_player_id != null) golfers.add(row.roster_player_id);
    playerCountByTournament.set(
      row.tournament_id,
      (playerCountByTournament.get(row.tournament_id) || 0) + 1
    );
  }

  const rounds = new Set<string>();
  for (const row of scorePairs) {
    rounds.add(`${row.tournament_id}:${row.player_id}`);
  }

  let moneyMovedCents = 0;
  for (const t of buyInRows) {
    const n = playerCountByTournament.get(t.id) || 0;
    moneyMovedCents += (t.buy_in_cents || 0) * n;
  }

  return {
    tournaments: tournamentsCount,
    scores: scoresCount,
    golfers: golfers.size,
    rounds: rounds.size,
    moneyMovedCents,
  };
}
