"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { formatCents } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

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
              <span className="text-sm text-[#006747]/60">Group Pot</span>
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
            {currentGroup.skinsSummary.results
              .filter((r) => r.skinsValue > 0 || r.carryover > 0)
              .map((result, i) => (
                <div
                  key={result.hole}
                  className={cn(
                    "grid grid-cols-[48px_1fr_80px] items-center border-b border-[#d4e4db]/50",
                    i % 2 === 0 ? "bg-white" : "bg-[#f2f7f4]"
                  )}
                >
                  <span className="py-2.5 text-center text-sm font-bold text-[#006747]">
                    {result.hole}
                  </span>
                  <span className="py-2.5 pl-3 text-sm">
                    {result.winnerId ? (
                      <span className="font-semibold text-[#006747]">
                        {currentGroup.playerNames[result.winnerId]}
                        {result.skinsValue > 1 && " 💰"}
                      </span>
                    ) : (
                      <span className="text-[#006747]/50">Push</span>
                    )}
                  </span>
                  <span className={cn(
                    "py-2.5 text-center text-sm font-bold",
                    result.winnerId ? "text-[#006747]" : "text-[#006747]/40"
                  )}>
                    {result.winnerId
                      ? result.skinsValue
                      : `→ ${result.carryover}`}
                  </span>
                </div>
              ))}
            {currentGroup.skinsSummary.results.filter(
              (r) => r.skinsValue > 0 || r.carryover > 0
            ).length === 0 && (
              <div className="py-8 text-center text-sm text-[#006747]/40">
                No skins awarded yet
              </div>
            )}
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

      {/* Live indicator */}
      <div className="flex items-center justify-center gap-1.5 py-3 text-xs text-[#006747]/50">
        <span className="w-2 h-2 rounded-full bg-[#006747] animate-pulse" />
        Live
      </div>
    </div>
  );
}
