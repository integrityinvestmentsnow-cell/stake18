"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/types";

interface GroupSkins {
  group: { id: number; name: string };
  players: {
    id: number;
    name: string;
    nickname: string | null;
    avatarEmoji: string | null;
  }[];
  skinsSummary: {
    results: { hole: number; winnerId: number | null; skinsValue: number }[];
    playerSkins: Record<number, number>;
    totalSkinsAwarded: number;
  };
  payouts: Record<number, number>;
  playerNames: Record<number, string>;
  totalPotCents: number;
}

export default function RecapPage() {
  const params = useParams();
  const id = params.id as string;
  const [groupsData, setGroupsData] = useState<GroupSkins[]>([]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/t/${id}/skins`);
    if (!res.ok) return;
    const data = await res.json();
    setGroupsData(data.results);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build recap slides
  const slides: { title: string; emoji: string; content: string; detail: string }[] = [];

  for (const group of groupsData) {
    // Biggest skin win
    const biggestWin = group.skinsSummary.results
      .filter((r) => r.winnerId !== null)
      .sort((a, b) => b.skinsValue - a.skinsValue)[0];

    if (biggestWin) {
      slides.push({
        title: "Biggest Skin Win",
        emoji: "💰",
        content: `${group.playerNames[biggestWin.winnerId!]} won ${biggestWin.skinsValue} skins on hole ${biggestWin.hole}`,
        detail: group.group.name,
      });
    }

    // Top earner in group
    const topEarner = group.players.sort(
      (a, b) => (group.payouts[b.id] || 0) - (group.payouts[a.id] || 0)
    )[0];

    if (topEarner && (group.payouts[topEarner.id] || 0) > 0) {
      slides.push({
        title: "Top Earner",
        emoji: "🏆",
        content: `${topEarner.nickname || topEarner.name} takes home ${formatCents(group.payouts[topEarner.id])}`,
        detail: group.group.name,
      });
    }

    // Most pushes
    const pushCount = group.skinsSummary.results.filter(
      (r) => r.winnerId === null && r.skinsValue === 0
    ).length;
    if (pushCount > 3) {
      slides.push({
        title: "Battle Royale",
        emoji: "⚔️",
        content: `${pushCount} pushes in ${group.group.name} — it was a war out there`,
        detail: group.group.name,
      });
    }
  }

  // Final payouts slide
  if (groupsData.length > 0) {
    const allPayouts = groupsData.flatMap((g) =>
      g.players.map((p) => ({
        name: p.nickname || p.name,
        emoji: p.avatarEmoji || "🏌️",
        payout: g.payouts[p.id] || 0,
        buyIn: g.totalPotCents / g.players.length,
      }))
    );

    const biggestWinner = allPayouts.sort(
      (a, b) => b.payout - b.buyIn - (a.payout - a.buyIn)
    )[0];

    if (biggestWinner) {
      const net = biggestWinner.payout - biggestWinner.buyIn;
      slides.push({
        title: net > 0 ? "Today's Champion" : "Better Luck Next Time",
        emoji: net > 0 ? "👑" : "😅",
        content: `${biggestWinner.name}: ${net > 0 ? "+" : ""}${formatCents(net)} net`,
        detail: "Overall",
      });
    }
  }

  if (slides.length === 0) {
    slides.push({
      title: "No Results Yet",
      emoji: "⛳",
      content: "Finalize the tournament to see the recap",
      detail: "",
    });
  }

  const currentSlide = slides[slideIndex] || slides[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading recap...</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 max-w-lg mx-auto">
      <h2 className="text-lg font-bold mb-6">Round Recap</h2>

      {/* Story Slide */}
      <Card className="bg-card border-border overflow-hidden">
        <CardContent className="py-16 text-center">
          <p className="text-6xl mb-4">{currentSlide.emoji}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
            {currentSlide.title}
          </p>
          <p className="text-xl font-bold mb-2">{currentSlide.content}</p>
          {currentSlide.detail && (
            <p className="text-sm text-muted-foreground">
              {currentSlide.detail}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Slide Navigation */}
      <div className="flex items-center justify-center gap-3 mt-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSlideIndex(Math.max(0, slideIndex - 1))}
          disabled={slideIndex === 0}
        >
          Prev
        </Button>
        <div className="flex gap-1">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlideIndex(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === slideIndex ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setSlideIndex(Math.min(slides.length - 1, slideIndex + 1))
          }
          disabled={slideIndex === slides.length - 1}
        >
          Next
        </Button>
      </div>

      {/* Full Payouts */}
      <div className="mt-8 space-y-3">
        <h3 className="font-semibold">Final Payouts</h3>
        {groupsData.map((group) => (
          <div key={group.group.id} className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium">
              {group.group.name} — Pot: {formatCents(group.totalPotCents)}
            </p>
            {group.players
              .sort(
                (a, b) =>
                  (group.payouts[b.id] || 0) - (group.payouts[a.id] || 0)
              )
              .map((player) => {
                const payout = group.payouts[player.id] || 0;
                const buyIn = group.totalPotCents / group.players.length;
                const net = payout - buyIn;

                return (
                  <Card key={player.id} className="bg-card border-border">
                    <CardContent className="py-2.5 flex items-center gap-3">
                      <span className="text-lg">
                        {player.avatarEmoji || "🏌️"}
                      </span>
                      <span className="flex-1 text-sm font-medium">
                        {player.nickname || player.name}
                      </span>
                      <div className="text-right">
                        <p className="text-sm font-bold text-primary">
                          {formatCents(payout)}
                        </p>
                        <p
                          className={`text-[10px] ${
                            net > 0
                              ? "text-emerald-400"
                              : net < 0
                                ? "text-red-400"
                                : "text-muted-foreground"
                          }`}
                        >
                          {net > 0 ? "+" : ""}
                          {formatCents(net)} net
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}
