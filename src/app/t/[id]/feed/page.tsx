"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { REACTION_EMOJIS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface Highlight {
  hole: number;
  type: string;
  text: string;
  emoji: string;
  groupId: number;
  groupName: string;
}

interface Reaction {
  id: number;
  playerId: number;
  hole: number;
  emoji: string;
}

interface Award {
  title: string;
  emoji: string;
  player: string;
  detail: string;
}

export default function FeedPage() {
  const params = useParams();
  const id = params.id as string;
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [hotSeat, setHotSeat] = useState<{ name: string; skins: number } | null>(null);
  const [awards, setAwards] = useState<Award[]>([]);
  const [tournamentStatus, setTournamentStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [justReacted, setJustReacted] = useState<string | null>(null);

  const fetchFeed = useCallback(async () => {
    const res = await fetch(`/api/t/${id}/feed`);
    if (!res.ok) return;
    const data = await res.json();
    setHighlights(data.highlights);
    setReactions(data.reactions);
    setHotSeat(data.hotSeat);
    setAwards(data.awards || []);
    setTournamentStatus(data.status || "");
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchFeed();

    const supabase = createClient();
    const channel = supabase
      .channel(`feed-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scores", filter: `tournament_id=eq.${id}` },
        () => fetchFeed()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reactions", filter: `tournament_id=eq.${id}` },
        () => fetchFeed()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, fetchFeed]);

  async function sendReaction(hole: number, emoji: string) {
    setJustReacted(`${hole}-${emoji}`);
    setTimeout(() => setJustReacted(null), 600);

    await fetch(`/api/t/${id}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: 0, hole, emoji }),
    });
    fetchFeed();
  }

  function getReactionsForHole(hole: number) {
    const holeReactions = reactions.filter((r) => r.hole === hole);
    const counts: Record<string, number> = {};
    holeReactions.forEach((r) => {
      counts[r.emoji] = (counts[r.emoji] || 0) + 1;
    });
    return counts;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading feed...</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="px-4 pt-4 pb-3">
        <h2 className="text-xl font-bold text-[#006747]">Live Feed</h2>
      </div>

      <div className="px-4">
        {/* Post-Round Awards */}
        {awards.length > 0 && (
          <div className="mb-6">
            <div className="bg-[#006747] text-white rounded-t-lg px-4 py-2">
              <p className="font-bold text-sm text-center uppercase tracking-wider">
                {tournamentStatus === "finalized" ? "Final Awards" : "Current Awards"}
              </p>
            </div>
            <div className="border border-t-0 border-[#d4e4db] rounded-b-lg divide-y divide-[#d4e4db]">
              {awards.map((award, i) => (
                <div
                  key={`${award.title}-${i}`}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3",
                    i % 2 === 0 ? "bg-white" : "bg-[#f2f7f4]"
                  )}
                >
                  <span className="text-2xl">{award.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-[#006747]">
                      {award.title}
                    </p>
                    <p className="text-xs text-[#006747]/60">{award.detail}</p>
                  </div>
                  <span className="font-semibold text-sm text-[#006747] truncate max-w-[100px]">
                    {award.player}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hot Seat Alert */}
        {hotSeat && hotSeat.skins >= 3 && (
          <Card className="border-[#006747]/20 bg-[#006747]/5 mb-4">
            <CardContent className="py-3 text-center">
              <p className="text-sm text-[#006747]">
                🔥 <span className="font-bold">{hotSeat.name}</span>{" "}
                has {hotSeat.skins} skins — can anyone stop them?
              </p>
            </CardContent>
          </Card>
        )}

        {highlights.length === 0 && awards.length === 0 ? (
          <Card className="border-border">
            <CardContent className="py-12 text-center">
              <p className="text-2xl mb-2">📡</p>
              <p className="text-muted-foreground text-sm">
                No highlights yet. Scores will appear here as they come in.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {highlights.map((highlight, i) => {
              const holeCounts = getReactionsForHole(highlight.hole);
              const totalReactions = Object.values(holeCounts).reduce((a, b) => a + b, 0);

              return (
                <Card
                  key={`${highlight.hole}-${highlight.type}-${i}`}
                  className="border-[#d4e4db] overflow-hidden"
                >
                  <CardContent className="py-0 px-0">
                    {/* Highlight content */}
                    <div className="flex items-start gap-3 px-4 py-3">
                      <span className="text-2xl flex-shrink-0">{highlight.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#1a3c2a]">{highlight.text}</p>
                        <p className="text-[10px] text-[#006747]/40 mt-1">
                          {highlight.groupName}
                        </p>
                      </div>
                    </div>

                    {/* Quick Reactions */}
                    <div className="flex items-center border-t border-[#d4e4db]/50 bg-[#f2f7f4]/50">
                      {REACTION_EMOJIS.map((emoji) => {
                        const count = holeCounts[emoji] || 0;
                        const wasJustTapped = justReacted === `${highlight.hole}-${emoji}`;

                        return (
                          <button
                            key={emoji}
                            onClick={() => sendReaction(highlight.hole, emoji)}
                            className={cn(
                              "flex-1 flex items-center justify-center gap-1 py-2 transition-all active:scale-110 border-r border-[#d4e4db]/30 last:border-r-0",
                              wasJustTapped && "bg-[#006747]/10 scale-110"
                            )}
                          >
                            <span className={cn(
                              "text-base transition-transform",
                              wasJustTapped && "animate-bounce"
                            )}>
                              {emoji}
                            </span>
                            {count > 0 && (
                              <span className="text-[10px] font-semibold text-[#006747]">
                                {count}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Live indicator */}
      <div className="flex items-center justify-center gap-1.5 py-4 text-xs text-[#006747]/50">
        <span className="w-2 h-2 rounded-full bg-[#006747] animate-pulse" />
        Live
      </div>
    </div>
  );
}
