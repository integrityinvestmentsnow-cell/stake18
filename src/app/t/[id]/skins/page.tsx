"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { formatCents } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useTournament } from "@/lib/tournament-context";

interface SkinResult {
  hole: number;
  winnerId: number | null;
  skinsValue: number;
  carryover: number;
}

interface GroupSkins {
  group: { id: number; name: string };
  players: {
    id: number;
    name: string;
    nickname: string | null;
    avatarEmoji: string | null;
  }[];
  skinsSummary: {
    results: SkinResult[];
    playerSkins: Record<number, number>;
    totalSkinsAwarded: number;
  };
  payouts: Record<number, number>;
  playerNames: Record<number, string>;
  totalPotCents: number;
}

export default function SkinsPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: tournamentData, scores: allScores } = useTournament();
  const [groupsData, setGroupsData] = useState<GroupSkins[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSkins = useCallback(async () => {
    const res = await fetch(`/api/t/${id}/skins`);
    if (!res.ok) return;
    const data = await res.json();
    setGroupsData(data.results);

    if (data.results.length > 0 && !selectedGroupId) {
      const saved = localStorage.getItem(`stake18-group-${id}`);
      const savedId = saved ? parseInt(saved) : null;
      const found = data.results.find(
        (g: GroupSkins) => g.group.id === savedId
      );
      setSelectedGroupId(found ? savedId : data.results[0].group.id);
    }
    setLoading(false);
  }, [id, selectedGroupId]);

  useEffect(() => {
    fetchSkins();

    const supabase = createClient();
    const channel = supabase
      .channel(`skins-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scores", filter: `tournament_id=eq.${id}` },
        () => fetchSkins()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, fetchSkins]);

  const currentGroup = groupsData.find((g) => g.group.id === selectedGroupId);

  const currentCarryover = currentGroup
    ? currentGroup.skinsSummary.results
        .filter((r) => r.carryover > 0)
        .slice(-1)[0]?.carryover || 0
    : 0;

  function getStreak(playerId: number): number {
    if (!currentGroup) return 0;
    let streak = 0;
    const results = [...currentGroup.skinsSummary.results].reverse();
    for (const r of results) {
      if (r.winnerId === playerId) streak++;
      else if (r.winnerId !== null) break;
    }
    return streak;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading skins...</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="px-4 pt-4 pb-3">
        <h2 className="text-xl font-bold text-[#006747]">Skins</h2>
      </div>

      {/* Group Selector */}
      {groupsData.length > 1 && (
        <div className="flex gap-2 px-4 mb-4 overflow-x-auto pb-1">
          {groupsData.map((g) => (
            <button
              key={g.group.id}
              onClick={() => setSelectedGroupId(g.group.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                selectedGroupId === g.group.id
                  ? "bg-[#006747] text-white"
                  : "bg-[#f2f7f4] border border-[#d4e4db] text-[#006747]"
              }`}
            >
              {g.group.name}
            </button>
          ))}
        </div>
      )}

      {!currentGroup ? (
        <div className="px-4">
          <Card className="border-border">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No groups yet</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="px-4">
          {/* Carryover Ticker */}
          {currentCarryover > 0 && (
            <Card className="border-[#006747]/30 mb-4 bg-[#006747]/5">
              <CardContent className="py-4 text-center">
                <p className="text-xs text-[#006747]/60 uppercase tracking-wider mb-1">
                  Riding on the next hole
                </p>
                <p className="text-3xl font-bold text-[#006747]">
                  {currentCarryover} {currentCarryover === 1 ? "skin" : "skins"}
                </p>
                <p className="text-sm text-[#006747]/60 mt-1">
                  Worth{" "}
                  {formatCents(
                    (currentGroup.totalPotCents /
                      (currentGroup.skinsSummary.totalSkinsAwarded || 18)) *
                      currentCarryover
                  )}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Pot Info */}
          <Card className="border-border mb-4">
            <CardContent className="py-3 flex items-center justify-between">
              <span className="text-sm text-[#006747]/60">Total Pot</span>
              <span className="font-bold text-[#006747] text-lg">
                {formatCents(currentGroup.totalPotCents)}
              </span>
            </CardContent>
          </Card>

          {/* Hole-by-Hole Results Table */}
          <div className="overflow-hidden rounded-lg border border-[#d4e4db] mb-6">
            <div className="grid grid-cols-[48px_1fr_80px] bg-[#006747] text-white text-[11px] font-bold uppercase tracking-wide">
              <span className="py-2 text-center">Hole</span>
              <span className="py-2 pl-3">Result</span>
              <span className="py-2 text-center">Skins</span>
            </div>
            {(() => {
              const totalPlayers = currentGroup.players.length;
              const numHoles = tournamentData?.tournament.numHoles || 18;
              const holes = Array.from({ length: numHoles }, (_, i) => i + 1);

              // Compute provisional winners for holes without confirmed results
              const provisionalWinners: Record<number, { playerId: number; tied: boolean }> = {};
              for (const hole of holes) {
                const holeScores = allScores.filter((s) => s.hole === hole);
                if (holeScores.length > 0 && holeScores.length < totalPlayers) {
                  const minStrokes = Math.min(...holeScores.map((s) => s.strokes));
                  const playersWithMin = holeScores.filter((s) => s.strokes === minStrokes);
                  provisionalWinners[hole] = {
                    playerId: playersWithMin[0].playerId,
                    tied: playersWithMin.length > 1,
                  };
                }
              }

              return holes.map((hole, i) => {
                const result = currentGroup.skinsSummary.results.find((r) => r.hole === hole);
                const provisional = provisionalWinners[hole];
                const holeScores = allScores.filter((s) => s.hole === hole);
                const hasAnyScores = holeScores.length > 0;
                const allScored = holeScores.length >= totalPlayers;

                // Determine what to show
                let displayName = "";
                let isConfirmed = false;
                let isProvisional = false;
                let isPush = false;
                let skinsDisplay = "";

                if (result && result.winnerId && result.skinsValue > 0) {
                  // Confirmed skin winner
                  displayName = currentGroup.playerNames[result.winnerId] || "";
                  isConfirmed = true;
                  skinsDisplay = String(result.skinsValue);
                } else if (result && !result.winnerId && allScored) {
                  // Confirmed push
                  isPush = true;
                  skinsDisplay = result.carryover > 0 ? `→ ${result.carryover}` : "—";
                } else if (provisional && !provisional.tied) {
                  // Provisional leader
                  displayName = currentGroup.playerNames[provisional.playerId] || "";
                  isProvisional = true;
                  skinsDisplay = "•";
                } else if (provisional && provisional.tied) {
                  // Provisional tie
                  isPush = true;
                  isProvisional = true;
                  skinsDisplay = "—";
                } else if (!hasAnyScores) {
                  // No scores yet
                  skinsDisplay = "—";
                }

                // Skip holes with nothing to show
                if (!hasAnyScores && !isConfirmed) return null;

                return (
                  <div
                    key={hole}
                    className={cn(
                      "grid grid-cols-[48px_1fr_80px] items-center border-b border-[#d4e4db]/50",
                      i % 2 === 0 ? "bg-white" : "bg-[#f2f7f4]"
                    )}
                  >
                    <span className="py-2.5 text-center text-sm font-bold text-[#006747]">
                      {hole}
                    </span>
                    <span className="py-2.5 pl-3 text-sm">
                      {displayName ? (
                        <span className={cn(
                          "font-semibold",
                          isConfirmed ? "text-[#006747]" : "text-[#006747]/50"
                        )}>
                          {displayName}
                          {isConfirmed && result && result.skinsValue > 1 && " 💰"}
                          {isProvisional && " ·"}
                        </span>
                      ) : isPush ? (
                        <span className="text-[#006747]/40">
                          {allScored ? "Push" : "Tied"}
                        </span>
                      ) : (
                        <span className="text-[#006747]/30">—</span>
                      )}
                    </span>
                    <span className={cn(
                      "py-2.5 text-center text-sm font-bold",
                      isConfirmed ? "text-[#006747]" : "text-[#006747]/30"
                    )}>
                      {skinsDisplay}
                    </span>
                  </div>
                );
              }).filter(Boolean);
            })()}
          </div>

          {/* Payout Summary */}
          <h3 className="font-bold text-[#006747] mb-3">Payouts</h3>
          <div className="overflow-hidden rounded-lg border border-[#d4e4db]">
            <div className="grid grid-cols-[1fr_60px_80px] bg-[#006747] text-white text-[11px] font-bold uppercase tracking-wide">
              <span className="py-2 pl-3">Player</span>
              <span className="py-2 text-center">Skins</span>
              <span className="py-2 text-center">Payout</span>
            </div>
            {currentGroup.players
              .sort(
                (a, b) =>
                  (currentGroup.skinsSummary.playerSkins[b.id] || 0) -
                  (currentGroup.skinsSummary.playerSkins[a.id] || 0)
              )
              .map((player, i) => {
                const skins = currentGroup.skinsSummary.playerSkins[player.id] || 0;
                const payout = currentGroup.payouts[player.id] || 0;
                const streak = getStreak(player.id);

                return (
                  <div
                    key={player.id}
                    className={cn(
                      "grid grid-cols-[1fr_60px_80px] items-center border-b border-[#d4e4db]/50",
                      i % 2 === 0 ? "bg-white" : "bg-[#f2f7f4]"
                    )}
                  >
                    <div className="py-2.5 pl-3 flex items-center gap-2">
                      <span className="text-sm">{player.avatarEmoji || "🏌️"}</span>
                      <span className="font-semibold text-sm text-[#006747]">
                        {player.nickname || player.name}
                      </span>
                      {streak >= 2 && (
                        <span className="text-xs">🔥{streak}</span>
                      )}
                    </div>
                    <span className="py-2.5 text-center text-sm text-[#006747]">
                      {skins}
                    </span>
                    <span className={cn(
                      "py-2.5 text-center text-sm font-bold",
                      payout > 0 ? "text-[#006747]" : "text-[#006747]/30"
                    )}>
                      {payout > 0 ? formatCents(payout) : "-"}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Share Results */}
      {currentGroup && currentGroup.skinsSummary.totalSkinsAwarded > 0 && (
        <div className="px-4 mt-4">
          <button
            onClick={() => {
              const lines = [`🏆 ${tournamentData?.tournament.name || "Skins"} — Results\n`];
              lines.push(`💰 Total Pot: ${formatCents(currentGroup.totalPotCents)}\n`);

              // Low Gross & Low Net
              if (tournamentData) {
                const courseHoles = tournamentData.courseHoles || [];
                const numHoles = tournamentData.tournament.numHoles || 18;
                const hasHoleHcps = courseHoles.some((h) => h.hcp);

                const playerTotals = tournamentData.players
                  .map((p) => {
                    const pScores = allScores.filter((s) => s.playerId === p.id);
                    const gross = pScores.reduce((s, sc) => s + sc.strokes, 0);
                    const holesPlayed = pScores.length;

                    let hcpStrokes = 0;
                    if (hasHoleHcps && p.handicap > 0) {
                      hcpStrokes = pScores.reduce((strokes, s) => {
                        const holeHcp = courseHoles.find((h) => h.hole === s.hole)?.hcp;
                        if (holeHcp && p.handicap >= holeHcp) {
                          return strokes + (p.handicap >= holeHcp + 18 ? 2 : 1);
                        }
                        return strokes;
                      }, 0);
                    } else {
                      hcpStrokes = Math.round((p.handicap * holesPlayed) / numHoles);
                    }

                    return {
                      name: p.nickname || p.name,
                      gross,
                      net: gross - hcpStrokes,
                      handicap: p.handicap,
                      holesPlayed,
                    };
                  })
                  .filter((p) => p.holesPlayed >= 9);

                if (playerTotals.length > 0) {
                  const lowGross = [...playerTotals].sort((a, b) => a.gross - b.gross)[0];
                  lines.push(`🏆 Low Gross: ${lowGross.name} (${lowGross.gross})`);

                  const hasHandicaps = playerTotals.some((p) => p.handicap > 0);
                  if (hasHandicaps) {
                    const lowNet = [...playerTotals].sort((a, b) => a.net - b.net)[0];
                    lines.push(`🥇 Low Net: ${lowNet.name} (net ${lowNet.net})`);
                  }
                  lines.push("");
                }
              }

              lines.push("Skins:");
              currentGroup.players
                .sort((a, b) =>
                  (currentGroup.skinsSummary.playerSkins[b.id] || 0) -
                  (currentGroup.skinsSummary.playerSkins[a.id] || 0)
                )
                .forEach((p, i) => {
                  const skins = currentGroup.skinsSummary.playerSkins[p.id] || 0;
                  const payout = currentGroup.payouts[p.id] || 0;
                  const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "  ";
                  lines.push(`${medal} ${p.nickname || p.name}: ${skins} skins — ${payout > 0 ? formatCents(payout) : "$0"}`);
                });
              lines.push(`\n⛳ stake18golf.com`);

              const text = lines.join("\n");
              if (navigator.share) {
                navigator.share({ title: "Skins Results", text });
              } else {
                navigator.clipboard.writeText(text);
                alert("Results copied!");
              }
            }}
            className="w-full py-3 rounded-lg border border-[#006747] text-[#006747] font-semibold text-sm hover:bg-[#006747]/5 transition-colors"
          >
            Share Results
          </button>
        </div>
      )}

      {/* Live indicator */}
      <div className="flex items-center justify-center gap-1.5 py-3 text-xs text-[#006747]/50">
        <span className="w-2 h-2 rounded-full bg-[#006747] animate-pulse" />
        Live
      </div>
    </div>
  );
}
