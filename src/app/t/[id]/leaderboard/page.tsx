"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useTournament } from "@/lib/tournament-context";
import { computeSkins, type SkinsRule } from "@/lib/skins";

interface LeaderboardEntry {
  playerId: number;
  name: string;
  nickname: string | null;
  avatarEmoji: string;
  handicap: number;
  totalStrokes: number;
  holesCompleted: number;
  toPar: number;
  netStrokes: number;
  netToPar: number;
}

export default function LeaderboardPage() {
  const params = useParams();
  const id = params.id as string;
  const { data, scores: allScores, loading } = useTournament();
  const [selectedPlayer, setSelectedPlayer] = useState<LeaderboardEntry | null>(null);
  const [viewMode, setViewMode] = useState<"gross" | "net" | "skins">("gross");
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const leaderboardStyle = data?.tournament.leaderboardStyle || "modern";

  function displayName(entry: { name: string; nickname: string | null }): string {
    if (leaderboardStyle === "classical") {
      // First initial + last name (e.g. "S. Huntington")
      const parts = entry.name.trim().split(/\s+/);
      if (parts.length >= 2) {
        const firstName = parts[0];
        const lastName = parts.slice(1).join(" ");
        return `${firstName[0]}. ${lastName}`;
      }
      return entry.name;
    }
    // Modern: nickname or first name
    return entry.nickname || entry.name;
  }

  const courseHoles = useMemo(
    () =>
      (data?.courseHoles || [])
        .map((h) => ({ hole: h.hole, par: h.par, hcp: h.hcp }))
        .sort((a, b) => a.hole - b.hole),
    [data]
  );

  const entries = useMemo(() => {
    if (!data) return [];

    const coursePars: Record<number, number> = {};
    courseHoles.forEach((h) => (coursePars[h.hole] = h.par));
    const totalCourseHoles = courseHoles.length || 18;
    const hasHoleHcps = courseHoles.some((h) => h.hcp);

    return data.players.map((player) => {
      const playerScores = allScores.filter((s) => s.playerId === player.id);
      const totalStrokes = playerScores.reduce((sum, s) => sum + s.strokes, 0);
      const holesCompleted = playerScores.length;
      const parForPlayed = playerScores.reduce(
        (sum, s) => sum + (coursePars[s.hole] || 4),
        0
      );

      let handicapStrokes: number;
      const hcp = player.handicap || 0;
      if (hasHoleHcps && hcp > 0) {
        handicapStrokes = playerScores.reduce((strokes, s) => {
          const holeHcp = courseHoles.find((h) => h.hole === s.hole)?.hcp;
          if (holeHcp && hcp >= holeHcp) {
            return strokes + (hcp >= holeHcp + 18 ? 2 : 1);
          }
          return strokes;
        }, 0);
      } else {
        handicapStrokes = Math.round((hcp * holesCompleted) / totalCourseHoles);
      }

      return {
        playerId: player.id,
        name: player.name,
        nickname: player.nickname,
        avatarEmoji: player.avatarEmoji || "🏌️",
        handicap: hcp,
        totalStrokes,
        holesCompleted,
        toPar: totalStrokes - parForPlayed,
        netStrokes: totalStrokes - handicapStrokes,
        netToPar: totalStrokes - handicapStrokes - parForPlayed,
      };
    });
  }, [data, allScores, courseHoles]);

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      if (b.holesCompleted !== a.holesCompleted)
        return b.holesCompleted - a.holesCompleted;
      if (viewMode === "net") return a.netToPar - b.netToPar;
      return a.toPar - b.toPar;
    });
  }, [entries, viewMode]);

  // Compute skins data for the skins view
  const skinsData = useMemo(() => {
    if (!data) return null;
    const playerIds = (data.players || []).map((p) => p.id);
    const scoresMapped = allScores.map((s) => ({
      playerId: s.playerId,
      hole: s.hole,
      strokes: s.strokes,
    }));
    const skinsRule = (data.tournament.skinsRule || "carry_over") as SkinsRule;
    return computeSkins(scoresMapped, playerIds, data.tournament.numHoles, "split_among_winners", skinsRule);
  }, [data, allScores]);

  function formatToPar(toPar: number): string {
    if (toPar === 0) return "E";
    if (toPar > 0) return `+${toPar}`;
    return String(toPar);
  }

  function getRank(sorted: LeaderboardEntry[], index: number): string {
    if (index === 0) return "1";
    const prev = sorted[index - 1];
    const curr = sorted[index];
    const prevScore = viewMode === "net" ? prev.netToPar : prev.toPar;
    const currScore = viewMode === "net" ? curr.netToPar : curr.toPar;
    if (prevScore === currScore && prev.holesCompleted === curr.holesCompleted) {
      const firstIdx = sorted.findIndex((e) => {
        const eScore = viewMode === "net" ? e.netToPar : e.toPar;
        return eScore === currScore && e.holesCompleted === curr.holesCompleted;
      });
      return `T${firstIdx + 1}`;
    }
    return String(index + 1);
  }

  function getPlayerHoleScores(playerId: number) {
    return courseHoles.map((h) => {
      const score = allScores.find(
        (s) => s.playerId === playerId && s.hole === h.hole
      );
      return { hole: h.hole, par: h.par, strokes: score?.strokes ?? null };
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-[#006747]">Loading leaderboard...</p>
      </div>
    );
  }

  return (
    <div
      className="max-w-lg mx-auto"
      onTouchStart={(e) => setTouchStart(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchStart === null) return;
        const diff = touchStart - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 50) {
          const views: ("gross" | "net" | "skins")[] = ["gross", "net", "skins"];
          const idx = views.indexOf(viewMode);
          if (diff > 0) {
            setViewMode(views[Math.min(idx + 1, views.length - 1)]);
          } else {
            setViewMode(views[Math.max(idx - 1, 0)]);
          }
        }
        setTouchStart(null);
      }}
    >
      <div className="px-4 pt-4 pb-3">
        <h2 className="text-xl font-bold text-[#006747]">Leader Board</h2>
        <div className="flex items-center gap-0 mt-2 bg-[#f2f7f4] rounded-lg p-0.5">
          <button
            onClick={() => setViewMode("gross")}
            className={cn(
              "flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors",
              viewMode === "gross" ? "bg-[#006747] text-white" : "text-[#006747]/60"
            )}
          >
            Gross
          </button>
          <button
            onClick={() => setViewMode("net")}
            className={cn(
              "flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors",
              viewMode === "net" ? "bg-[#006747] text-white" : "text-[#006747]/60"
            )}
          >
            Net
          </button>
          <button
            onClick={() => setViewMode("skins")}
            className={cn(
              "flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors",
              viewMode === "skins" ? "bg-[#006747] text-white" : "text-[#006747]/60"
            )}
          >
            Skins
          </button>
        </div>
      </div>

      {viewMode === "skins" ? (
        /* Skins Scorecard View */
        <div className="overflow-x-auto">
          {sortedEntries.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-[#006747]/50">No scores yet.</p>
            </div>
          ) : (
            <table className="text-[10px] border-collapse min-w-[600px] w-full">
              <thead>
                {/* Hole numbers */}
                <tr className="bg-[#006747] text-white">
                  <th className="py-1 px-1 text-left font-bold sticky left-0 bg-[#006747] z-10 w-8">Pos</th>
                  <th className="py-1 px-1 text-left font-bold sticky left-[32px] bg-[#006747] z-10 min-w-[70px]">Player</th>
                  {courseHoles.slice(0, 9).map((h) => (
                    <th key={h.hole} className="py-1 w-5 text-center font-bold">{h.hole}</th>
                  ))}
                  <th className="py-1 w-6 text-center font-bold border-l border-white/20">Out</th>
                  {courseHoles.slice(9, 18).map((h) => (
                    <th key={h.hole} className="py-1 w-5 text-center font-bold">{h.hole}</th>
                  ))}
                  <th className="py-1 w-6 text-center font-bold border-l border-white/20">In</th>
                  <th className="py-1 w-7 text-center font-bold border-l border-white/20">Tot</th>
                  <th className="py-1 w-6 text-center font-bold">Thru</th>
                  <th className="py-1 w-7 text-center font-bold">+/-</th>
                </tr>
                {/* Par row */}
                <tr className="bg-[#f2f7f4] text-[#006747]">
                  <td className="py-1 px-1 sticky left-0 bg-[#f2f7f4] z-10"></td>
                  <td className="py-1 px-1 font-bold sticky left-[32px] bg-[#f2f7f4] z-10">Par</td>
                  {courseHoles.slice(0, 9).map((h) => (
                    <td key={h.hole} className="py-1 text-center font-semibold">{h.par}</td>
                  ))}
                  <td className="py-1 text-center font-bold border-l border-[#d4e4db]">
                    {courseHoles.slice(0, 9).reduce((s, h) => s + h.par, 0)}
                  </td>
                  {courseHoles.slice(9, 18).map((h) => (
                    <td key={h.hole} className="py-1 text-center font-semibold">{h.par}</td>
                  ))}
                  <td className="py-1 text-center font-bold border-l border-[#d4e4db]">
                    {courseHoles.slice(9, 18).reduce((s, h) => s + h.par, 0)}
                  </td>
                  <td className="py-1 text-center font-bold border-l border-[#d4e4db]">
                    {courseHoles.reduce((s, h) => s + h.par, 0)}
                  </td>
                  <td className="py-1"></td>
                  <td className="py-1"></td>
                </tr>
              </thead>
              <tbody>
                {sortedEntries.map((entry, idx) => {
                  const rank = getRank(sortedEntries, idx);
                  const holeScores = getPlayerHoleScores(entry.playerId);
                  const front = holeScores.slice(0, 9);
                  const back = holeScores.slice(9, 18);
                  const frontTotal = front.filter((h) => h.strokes !== null).reduce((s, h) => s + (h.strokes || 0), 0);
                  const backTotal = back.filter((h) => h.strokes !== null).reduce((s, h) => s + (h.strokes || 0), 0);

                  return (
                    <tr
                      key={entry.playerId}
                      className={cn(
                        "border-b border-[#d4e4db]/50",
                        idx % 2 === 0 ? "bg-white" : "bg-[#f2f7f4]"
                      )}
                    >
                      <td className={cn("py-1.5 px-1 font-bold text-[#006747] sticky left-0 z-10", idx % 2 === 0 ? "bg-white" : "bg-[#f2f7f4]")}>
                        {rank}
                      </td>
                      <td className={cn("py-1.5 px-1 font-semibold text-[#006747] truncate max-w-[70px] sticky left-[32px] z-10", idx % 2 === 0 ? "bg-white" : "bg-[#f2f7f4]")}>
                        {displayName(entry)}
                      </td>
                      {/* Front 9 */}
                      {front.map((h) => {
                        const skinWinner = skinsData?.results.find(
                          (r) => r.hole === h.hole && r.winnerId === entry.playerId && r.skinsValue > 0
                        );
                        return (
                          <td key={h.hole} className="py-1 text-center">
                            {h.strokes !== null ? (
                              <span className={cn(
                                "inline-block min-w-[14px] text-center font-bold",
                                skinWinner
                                  ? "bg-[#006747] text-white rounded-sm px-0.5"
                                  : "text-[#1a3c2a]"
                              )}>
                                {h.strokes}
                              </span>
                            ) : (
                              <span className="text-[#ccc]">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-1 text-center font-bold text-[#006747] border-l border-[#d4e4db]">
                        {frontTotal || "-"}
                      </td>
                      {/* Back 9 */}
                      {back.map((h) => {
                        const skinWinner = skinsData?.results.find(
                          (r) => r.hole === h.hole && r.winnerId === entry.playerId && r.skinsValue > 0
                        );
                        return (
                          <td key={h.hole} className="py-1 text-center">
                            {h.strokes !== null ? (
                              <span className={cn(
                                "inline-block min-w-[14px] text-center font-bold",
                                skinWinner
                                  ? "bg-[#006747] text-white rounded-sm px-0.5"
                                  : "text-[#1a3c2a]"
                              )}>
                                {h.strokes}
                              </span>
                            ) : (
                              <span className="text-[#ccc]">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-1 text-center font-bold text-[#006747] border-l border-[#d4e4db]">
                        {backTotal || "-"}
                      </td>
                      <td className="py-1 text-center font-bold text-[#006747] border-l border-[#d4e4db]">
                        {entry.totalStrokes || "-"}
                      </td>
                      <td className="py-1 text-center text-[#006747]/70">
                        {entry.holesCompleted || "-"}
                      </td>
                      <td className={cn(
                        "py-1 text-center font-bold",
                        entry.toPar < 0 ? "text-red-600" : entry.toPar > 0 ? "text-[#333]" : "text-[#006747]"
                      )}>
                        {entry.holesCompleted > 0 ? formatToPar(entry.toPar) : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : sortedEntries.length === 0 ? (
        <div className="px-4 py-12 text-center">
          <p className="text-[#006747]/50">No scores yet. Start playing!</p>
        </div>
      ) : (
        <div className="overflow-hidden">
          <div className={cn(
            "gap-0 bg-[#006747] text-white text-[11px] font-bold uppercase tracking-wide",
            viewMode === "net"
              ? "grid grid-cols-[36px_1fr_40px_48px_40px]"
              : "grid grid-cols-[40px_1fr_48px_44px]"
          )}>
            <span className="py-2 text-center">Pos</span>
            <span className="py-2 pl-2">Player</span>
            {viewMode === "net" && <span className="py-2 text-center">Hcp</span>}
            <span className="py-2 text-center">+/-</span>
            <span className="py-2 text-center">Thru</span>
          </div>

          {sortedEntries.map((entry, index) => {
            const rank = getRank(sortedEntries, index);
            const isEven = index % 2 === 0;
            const displayToPar = viewMode === "net" ? entry.netToPar : entry.toPar;

            return (
              <div
                key={entry.playerId}
                onClick={() => setSelectedPlayer(entry)}
                className={cn(
                  "gap-0 items-center cursor-pointer active:bg-[#006747]/10 transition-colors border-b border-[#006747]/10",
                  isEven ? "bg-white" : "bg-[#f2f7f4]",
                  viewMode === "net"
                    ? "grid grid-cols-[36px_1fr_40px_48px_40px]"
                    : "grid grid-cols-[40px_1fr_48px_44px]"
                )}
              >
                <span className="py-2.5 text-center text-sm font-semibold text-[#006747]">{rank}</span>
                <span className="py-2.5 pl-2 text-sm font-semibold text-[#006747] truncate">
                  {displayName(entry)}
                </span>
                {viewMode === "net" && (
                  <span className="py-2.5 text-center text-xs text-[#006747]/50">{entry.handicap}</span>
                )}
                <span className={cn(
                  "py-2.5 text-center text-sm font-bold",
                  entry.holesCompleted === 0 ? "text-[#333]"
                    : displayToPar < 0 ? "text-red-600"
                    : displayToPar > 0 ? "text-[#333]"
                    : "text-[#006747]"
                )}>
                  {entry.holesCompleted > 0 ? formatToPar(displayToPar) : "-"}
                </span>
                <span className="py-2.5 text-center text-sm text-[#006747]/70">
                  {entry.holesCompleted || "-"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-center gap-1.5 py-3 text-xs text-[#006747]/50">
        <span className="w-2 h-2 rounded-full bg-[#006747] animate-pulse" />
        Live · Swipe to switch view
      </div>

      {/* Player Detail Modal */}
      <Dialog
        open={selectedPlayer !== null}
        onOpenChange={(open) => { if (!open) setSelectedPlayer(null); }}
      >
        <DialogContent className="bg-white border-[#006747]/20 max-w-[100vw] sm:max-w-lg text-[#006747] p-3 sm:p-4 rounded-lg sm:rounded-xl mx-1">
          <DialogHeader>
            <DialogTitle className="text-[#006747] text-base">Official Score Card</DialogTitle>
          </DialogHeader>

          {selectedPlayer && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{selectedPlayer.avatarEmoji}</span>
                  <span className="font-bold text-[#006747]">{displayName(selectedPlayer)}</span>
                </div>
                <span className={cn("font-bold text-sm", selectedPlayer.toPar < 0 ? "text-red-600" : selectedPlayer.toPar > 0 ? "text-[#333]" : "text-[#006747]")}>
                  {selectedPlayer.holesCompleted > 0 ? formatToPar(selectedPlayer.toPar) : ""}
                </span>
              </div>

              <div className="flex items-center gap-3 text-[9px] text-[#006747]/70 flex-wrap">
                <span className="flex items-center gap-1"><span className="w-3.5 h-3.5 rounded-full border-2 border-[#006747] inline-flex items-center justify-center"><span className="w-1.5 h-1.5 rounded-full bg-[#006747]" /></span> Eagle</span>
                <span className="flex items-center gap-1"><span className="w-3.5 h-3.5 rounded-full border-2 border-[#006747] inline-block" /> Birdie</span>
                <span className="flex items-center gap-1"><span className="w-3.5 h-3.5 border-2 border-[#006747] inline-block" /> Bogey</span>
                <span className="flex items-center gap-1"><span className="w-3.5 h-3.5 border-2 border-[#006747] bg-[#006747]/10 inline-block" /> D Bogey+</span>
              </div>

              {/* Front 9 */}
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#006747] text-white">
                    <th className="py-1.5 px-1 text-left font-bold w-9">Hole</th>
                    {courseHoles.slice(0, 9).map((h) => (
                      <th key={h.hole} className="py-1.5 text-center font-bold">{h.hole}</th>
                    ))}
                    <th className="py-1.5 px-1 text-center font-bold w-9">Out</th>
                  </tr>
                  <tr className="bg-[#f2f7f4] text-[#006747]">
                    <td className="py-1 px-1 font-bold">Par</td>
                    {courseHoles.slice(0, 9).map((h) => (
                      <td key={h.hole} className="py-1 text-center font-semibold">{h.par}</td>
                    ))}
                    <td className="py-1 px-1 text-center font-bold">{courseHoles.slice(0, 9).reduce((s, h) => s + h.par, 0)}</td>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-[#006747]/15">
                    <td className="py-1.5 px-1 font-bold text-[#006747]">R1</td>
                    {getPlayerHoleScores(selectedPlayer.playerId).slice(0, 9).map((h) => {
                      const diff = h.strokes !== null ? h.strokes - h.par : null;
                      return (
                        <td key={h.hole} className="py-1 text-center">
                          {h.strokes !== null ? (
                            <div className="flex items-center justify-center">
                              {diff !== null && diff <= -2 ? (
                                <span className="w-5 h-5 rounded-full border-2 border-[#006747] flex items-center justify-center">
                                  <span className="w-3.5 h-3.5 rounded-full border border-[#006747] flex items-center justify-center text-[9px] font-bold text-[#006747]">{h.strokes}</span>
                                </span>
                              ) : diff === -1 ? (
                                <span className="w-5 h-5 rounded-full border-2 border-[#006747] flex items-center justify-center text-[9px] font-bold text-[#006747]">{h.strokes}</span>
                              ) : diff === 1 ? (
                                <span className="w-5 h-5 border-2 border-[#006747] flex items-center justify-center text-[9px] font-bold text-[#006747]">{h.strokes}</span>
                              ) : diff !== null && diff >= 2 ? (
                                <span className="w-5 h-5 border-2 border-[#006747] bg-[#006747]/10 flex items-center justify-center text-[9px] font-bold text-[#006747]">{h.strokes}</span>
                              ) : (
                                <span className="w-5 h-5 flex items-center justify-center text-[9px] font-bold text-[#006747]">{h.strokes}</span>
                              )}
                            </div>
                          ) : <span className="text-[9px] text-[#ccc]">-</span>}
                        </td>
                      );
                    })}
                    <td className="py-1.5 px-1 text-center font-bold text-[#006747]">
                      {getPlayerHoleScores(selectedPlayer.playerId).slice(0, 9).filter((h) => h.strokes !== null).reduce((s, h) => s + (h.strokes || 0), 0) || "-"}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Back 9 */}
              {courseHoles.length > 9 && (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#006747] text-white">
                      <th className="py-1.5 px-1 text-left font-bold w-9">Hole</th>
                      {courseHoles.slice(9, 18).map((h) => (
                        <th key={h.hole} className="py-1.5 text-center font-bold">{h.hole}</th>
                      ))}
                      <th className="py-1.5 px-1 text-center font-bold w-9">In</th>
                      <th className="py-1.5 px-1 text-center font-bold w-9">Tot</th>
                    </tr>
                    <tr className="bg-[#f2f7f4] text-[#006747]">
                      <td className="py-1 px-1 font-bold">Par</td>
                      {courseHoles.slice(9, 18).map((h) => (
                        <td key={h.hole} className="py-1 text-center font-semibold">{h.par}</td>
                      ))}
                      <td className="py-1 px-1 text-center font-bold">{courseHoles.slice(9, 18).reduce((s, h) => s + h.par, 0)}</td>
                      <td className="py-1 px-1 text-center font-bold">{courseHoles.reduce((s, h) => s + h.par, 0)}</td>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-[#006747]/15">
                      <td className="py-1.5 px-1 font-bold text-[#006747]">R1</td>
                      {getPlayerHoleScores(selectedPlayer.playerId).slice(9, 18).map((h) => {
                        const diff = h.strokes !== null ? h.strokes - h.par : null;
                        return (
                          <td key={h.hole} className="py-1 text-center">
                            {h.strokes !== null ? (
                              <div className="flex items-center justify-center">
                                {diff !== null && diff <= -2 ? (
                                  <span className="w-5 h-5 rounded-full border-2 border-[#006747] flex items-center justify-center">
                                    <span className="w-3.5 h-3.5 rounded-full border border-[#006747] flex items-center justify-center text-[9px] font-bold text-[#006747]">{h.strokes}</span>
                                  </span>
                                ) : diff === -1 ? (
                                  <span className="w-5 h-5 rounded-full border-2 border-[#006747] flex items-center justify-center text-[9px] font-bold text-[#006747]">{h.strokes}</span>
                                ) : diff === 1 ? (
                                  <span className="w-5 h-5 border-2 border-[#006747] flex items-center justify-center text-[9px] font-bold text-[#006747]">{h.strokes}</span>
                                ) : diff !== null && diff >= 2 ? (
                                  <span className="w-5 h-5 border-2 border-[#006747] bg-[#006747]/10 flex items-center justify-center text-[9px] font-bold text-[#006747]">{h.strokes}</span>
                                ) : (
                                  <span className="w-5 h-5 flex items-center justify-center text-[9px] font-bold text-[#006747]">{h.strokes}</span>
                                )}
                              </div>
                            ) : <span className="text-[9px] text-[#ccc]">-</span>}
                          </td>
                        );
                      })}
                      <td className="py-1.5 px-1 text-center font-bold text-[#006747]">
                        {getPlayerHoleScores(selectedPlayer.playerId).slice(9, 18).filter((h) => h.strokes !== null).reduce((s, h) => s + (h.strokes || 0), 0) || "-"}
                      </td>
                      <td className="py-1.5 px-1 text-center font-bold text-[#006747]">{selectedPlayer.totalStrokes || "-"}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
