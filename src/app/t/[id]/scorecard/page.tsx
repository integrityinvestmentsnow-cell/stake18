"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { cn, scoreBgColor, scoreColor } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { queueScore, flushQueue, getQueuedCount } from "@/lib/offline-queue";

interface Player {
  id: number;
  name: string;
  nickname: string | null;
  avatarEmoji: string | null;
}

interface Group {
  id: number;
  name: string;
}

interface Score {
  playerId: number;
  hole: number;
  strokes: number;
}

interface CourseHole {
  hole: number;
  par: number;
}

export default function ScorecardPage() {
  const params = useParams();
  const id = params.id as string;

  const [players, setPlayers] = useState<Player[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupPlayerMap, setGroupPlayerMap] = useState<Record<number, number[]>>({});
  const [scores, setScores] = useState<Score[]>([]);
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [currentHole, setCurrentHole] = useState(1);
  const [holeScores, setHoleScores] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [queuedCount, setQueuedCount] = useState(0);
  const [showEditGroup, setShowEditGroup] = useState(false);
  const [editPlayerIds, setEditPlayerIds] = useState<number[]>([]);

  const fetchData = useCallback(async () => {
    const [tRes, sRes] = await Promise.all([
      fetch(`/api/t/${id}`),
      fetch(`/api/t/${id}/scores`),
    ]);

    if (tRes.ok && sRes.ok) {
      const tournament = await tRes.json();
      const scoresData = await sRes.json();

      setPlayers(tournament.players);
      setGroups(tournament.groups);
      setCourseHoles(
        tournament.courseHoles
          .map((h: { hole: number; par: number }) => ({
            hole: h.hole,
            par: h.par,
          }))
          .sort((a: CourseHole, b: CourseHole) => a.hole - b.hole)
      );
      setScores(scoresData);

      const gpMap: Record<number, number[]> = {};
      for (const gp of tournament.groupPlayers) {
        if (!gpMap[gp.groupId]) gpMap[gp.groupId] = [];
        gpMap[gp.groupId].push(gp.playerId);
      }
      setGroupPlayerMap(gpMap);

      // Check for "My Group" (created via PIN flow)
      const myGroup = localStorage.getItem(`stake18-my-group-${id}`);
      if (myGroup) {
        const { playerIds } = JSON.parse(myGroup);
        gpMap[-1] = playerIds;
        setGroupPlayerMap({ ...gpMap });
        setSelectedGroupId(-1);
      } else {
        // Check for ad-hoc player selection
        const adHoc = localStorage.getItem(`stake18-scoring-players-${id}`);
        if (adHoc && tournament.groups.length === 0) {
          const adHocIds: number[] = JSON.parse(adHoc);
          gpMap[-1] = adHocIds;
          setGroupPlayerMap({ ...gpMap });
          setSelectedGroupId(-1);
        } else {
          const saved = localStorage.getItem(`stake18-group-${id}`);
          if (saved && tournament.groups.find((g: Group) => g.id === parseInt(saved))) {
            setSelectedGroupId(parseInt(saved));
          } else if (tournament.groups.length > 0) {
            setSelectedGroupId(tournament.groups[0].id);
          }
        }
      }
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
    setQueuedCount(getQueuedCount());

    // Online/offline detection
    const goOnline = async () => {
      setIsOnline(true);
      const result = await flushQueue();
      setQueuedCount(getQueuedCount());
      if (result.synced > 0) {
        toast.success(`${result.synced} queued score${result.synced > 1 ? "s" : ""} synced`);
        // Re-fetch scores after sync
        fetch(`/api/t/${id}/scores`)
          .then((res) => res.json())
          .then((data) => setScores(data));
      }
    };
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    setIsOnline(navigator.onLine);

    // Real-time score updates
    const supabase = createClient();
    const channel = supabase
      .channel(`scorecard-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scores", filter: `tournament_id=eq.${id}` },
        () => {
          fetch(`/api/t/${id}/scores`)
            .then((res) => res.json())
            .then((data) => setScores(data));
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      supabase.removeChannel(channel);
    };
  }, [fetchData, id]);

  // Initialize hole scores when hole or group changes
  const groupPlayers = selectedGroupId
    ? players.filter((p) => (groupPlayerMap[selectedGroupId] || []).includes(p.id))
    : [];

  const currentPar = courseHoles.find((h) => h.hole === currentHole)?.par || 4;

  useEffect(() => {
    if (groupPlayers.length === 0) return;
    const newHoleScores: Record<number, number> = {};
    for (const player of groupPlayers) {
      const existing = scores.find(
        (s) => s.playerId === player.id && s.hole === currentHole
      );
      newHoleScores[player.id] = existing ? existing.strokes : currentPar;
    }
    setHoleScores(newHoleScores);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentHole, selectedGroupId, scores, currentPar]);

  function selectGroup(groupId: number) {
    setSelectedGroupId(groupId);
    localStorage.setItem(`stake18-group-${id}`, String(groupId));
  }

  function adjustScore(playerId: number, delta: number) {
    setHoleScores((prev) => {
      const current = prev[playerId] ?? currentPar;
      const next = Math.max(1, Math.min(15, current + delta));
      return { ...prev, [playerId]: next };
    });
  }

  async function saveHole() {
    setSaving(true);

    // Always update local scores immediately (optimistic)
    setScores((prev) => {
      const filtered = prev.filter((s) => s.hole !== currentHole || !groupPlayers.some((p) => p.id === s.playerId));
      const newScores = groupPlayers.map((p) => ({
        playerId: p.id,
        hole: currentHole,
        strokes: holeScores[p.id] ?? currentPar,
      }));
      return [...filtered, ...newScores];
    });

    // Try to save to server, queue if offline/failed
    let allSaved = true;
    for (const player of groupPlayers) {
      const strokes = holeScores[player.id] ?? currentPar;
      try {
        const res = await fetch(`/api/t/${id}/scores`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerId: player.id,
            hole: currentHole,
            strokes,
          }),
        });
        if (!res.ok) throw new Error("Save failed");
      } catch {
        // Queue for later sync
        queueScore({
          tournamentId: id,
          playerId: player.id,
          hole: currentHole,
          strokes,
          queuedAt: Date.now(),
        });
        allSaved = false;
      }
    }

    setQueuedCount(getQueuedCount());

    if (allSaved) {
      toast.success(`Hole ${currentHole} saved`);
    } else {
      toast.warning(`Hole ${currentHole} saved offline — will sync when connected`);
    }
    setSaving(false);

    // Auto-advance to next hole
    if (currentHole < courseHoles.length) {
      setCurrentHole(currentHole + 1);
    }
  }

  function getScoreLabel(strokes: number, par: number) {
    const diff = strokes - par;
    if (diff <= -2) return "Eagle";
    if (diff === -1) return "Birdie";
    if (diff === 0) return "Par";
    if (diff === 1) return "Bogey";
    if (diff === 2) return "Dbl Bogey";
    return `+${diff}`;
  }

  function getPlayerTotal(playerId: number): number {
    return scores
      .filter((s) => s.playerId === playerId)
      .reduce((sum, s) => sum + s.strokes, 0);
  }

  function getPlayerToPar(playerId: number): number {
    let total = 0;
    for (const s of scores.filter((s) => s.playerId === playerId)) {
      const par = courseHoles.find((h) => h.hole === s.hole)?.par || 4;
      total += s.strokes - par;
    }
    return total;
  }

  function getHolesCompleted(playerId: number): number {
    return scores.filter((s) => s.playerId === playerId).length;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading scorecard...</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 max-w-lg mx-auto">
      {/* My Group Header */}
      {groupPlayers.length > 0 && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-[#006747]">My Group</p>
            <div className="flex -space-x-1">
              {groupPlayers.slice(0, 4).map((p) => (
                <span key={p.id} className="text-sm">{p.avatarEmoji || "🏌️"}</span>
              ))}
              {groupPlayers.length > 4 && (
                <span className="text-xs text-muted-foreground ml-1">+{groupPlayers.length - 4}</span>
              )}
            </div>
          </div>
          <button
            onClick={() => {
              setEditPlayerIds(groupPlayers.map((p) => p.id));
              setShowEditGroup(true);
            }}
            className="text-xs font-semibold text-[#006747] hover:underline"
          >
            Edit Group
          </button>
        </div>
      )}

      {/* Group Selector (if multiple groups exist) */}
      {groups.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {groups.map((group) => (
            <button
              key={group.id}
              onClick={() => selectGroup(group.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                selectedGroupId === group.id
                  ? "bg-[#006747] text-white"
                  : "bg-[#f2f7f4] border border-[#d4e4db] text-[#006747]"
              }`}
            >
              {group.name}
            </button>
          ))}
        </div>
      )}

      {groupPlayers.length === 0 ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Select a group to enter scores</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Offline / Queue indicator */}
          {(!isOnline || queuedCount > 0) && (
            <div className={cn(
              "rounded-lg px-3 py-2 mb-3 text-sm flex items-center justify-between",
              !isOnline ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-blue-50 text-blue-700 border border-blue-200"
            )}>
              <span>
                {!isOnline
                  ? "You're offline — scores will sync when connected"
                  : `${queuedCount} score${queuedCount > 1 ? "s" : ""} waiting to sync`}
              </span>
              {isOnline && queuedCount > 0 && (
                <button
                  onClick={async () => {
                    const result = await flushQueue();
                    setQueuedCount(getQueuedCount());
                    if (result.synced > 0) {
                      toast.success(`${result.synced} score${result.synced > 1 ? "s" : ""} synced`);
                    }
                  }}
                  className="font-semibold underline ml-2"
                >
                  Sync now
                </button>
              )}
            </div>
          )}

          {/* Hole Progress Dots */}
          <div className="flex justify-center gap-1 mb-3">
            {courseHoles.map((h) => {
              const hasScore = groupPlayers.length > 0 &&
                groupPlayers.every((p) =>
                  scores.some((s) => s.playerId === p.id && s.hole === h.hole)
                );
              return (
                <button
                  key={h.hole}
                  onClick={() => setCurrentHole(h.hole)}
                  className={cn(
                    "w-5 h-5 rounded-full text-[8px] font-bold transition-all",
                    currentHole === h.hole
                      ? "bg-[#006747] text-white scale-110"
                      : hasScore
                        ? "bg-[#006747]/20 text-[#006747]"
                        : "bg-[#f2f7f4] text-[#006747]/30 border border-[#d4e4db]"
                  )}
                >
                  {h.hole}
                </button>
              );
            })}
          </div>

          {/* Hole Selector */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCurrentHole(Math.max(1, currentHole - 1))}
              disabled={currentHole === 1}
              className="w-10 h-10 rounded-lg bg-[#f2f7f4] border border-[#d4e4db] flex items-center justify-center text-lg font-bold text-[#006747] disabled:opacity-30 hover:bg-[#e5efe9] transition-colors"
            >
              &lt;
            </button>

            <div className="flex-1 text-center">
              <select
                value={currentHole}
                onChange={(e) => setCurrentHole(parseInt(e.target.value))}
                className="bg-transparent text-lg font-bold text-center text-[#006747] border-none outline-none cursor-pointer"
              >
                {courseHoles.map((h) => (
                  <option key={h.hole} value={h.hole}>
                    Hole {h.hole} (Par {h.par})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setCurrentHole(Math.min(courseHoles.length, currentHole + 1))}
              disabled={currentHole === courseHoles.length}
              className="w-10 h-10 rounded-lg bg-[#f2f7f4] border border-[#d4e4db] flex items-center justify-center text-lg font-bold text-[#006747] disabled:opacity-30 hover:bg-[#e5efe9] transition-colors"
            >
              &gt;
            </button>
          </div>

          {/* Player Scores */}
          <div className="space-y-2 mb-4">
            {groupPlayers.map((player) => {
              const strokes = holeScores[player.id] ?? currentPar;
              const diff = strokes - currentPar;

              return (
                <Card
                  key={player.id}
                  className={`border ${
                    diff < 0
                      ? "border-red-300"
                      : diff > 0
                        ? "border-gray-300"
                        : "border-border"
                  }`}
                >
                  <CardContent className="flex items-center gap-3 py-3">
                    <span className="text-xl">{player.avatarEmoji || "🏌️"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {player.nickname || player.name}
                      </p>
                      <p className={`text-xs ${
                        diff < 0
                          ? "text-red-600"
                          : diff > 0
                            ? "text-[#555]"
                            : "text-muted-foreground"
                      }`}>
                        {getScoreLabel(strokes, currentPar)}
                      </p>
                    </div>

                    <div className="flex items-center gap-0">
                      <button
                        onClick={() => adjustScore(player.id, -1)}
                        className="w-11 h-11 rounded-l-lg bg-muted border border-border flex items-center justify-center text-xl font-bold hover:bg-muted/80 active:scale-95 transition-all"
                      >
                        -
                      </button>
                      <div
                        className={`w-12 h-11 flex items-center justify-center text-xl font-bold border-y border-border ${scoreBgColor(strokes, currentPar)} ${scoreColor(strokes, currentPar)}`}
                      >
                        {strokes}
                      </div>
                      <button
                        onClick={() => adjustScore(player.id, 1)}
                        className="w-11 h-11 rounded-r-lg bg-muted border border-border flex items-center justify-center text-xl font-bold hover:bg-muted/80 active:scale-95 transition-all"
                      >
                        +
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Save Button */}
          {(() => {
            const holeAlreadySaved = groupPlayers.length > 0 &&
              groupPlayers.every((p) =>
                scores.some((s) => s.playerId === p.id && s.hole === currentHole)
              );
            return (
              <Button
                onClick={saveHole}
                disabled={saving}
                className={cn(
                  "w-full h-12 text-lg font-semibold mb-6",
                  holeAlreadySaved
                    ? "bg-[#006747]/80 hover:bg-[#006747]"
                    : "bg-[#006747] hover:bg-[#005538]"
                )}
              >
                {saving
                  ? "Saving..."
                  : holeAlreadySaved
                    ? `Update Hole ${currentHole}`
                    : `Save Hole ${currentHole}`}
              </Button>
            );
          })()}

          {/* Mini Leaderboard */}
          <div className="border-t border-border pt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">
              Gross Strokes
            </p>
            <div className="grid grid-cols-[1fr_60px_60px_60px] gap-1 text-[10px] text-muted-foreground uppercase tracking-wider px-2 mb-1">
              <span>Player</span>
              <span className="text-center">Thru</span>
              <span className="text-center">Total</span>
              <span className="text-center">+/-</span>
            </div>
            {groupPlayers
              .sort((a, b) => getPlayerToPar(a.id) - getPlayerToPar(b.id))
              .map((player) => {
                const thru = getHolesCompleted(player.id);
                const total = getPlayerTotal(player.id);
                const toPar = getPlayerToPar(player.id);

                return (
                  <div
                    key={player.id}
                    className="grid grid-cols-[1fr_60px_60px_60px] gap-1 items-center px-2 py-1.5 rounded"
                  >
                    <span className="text-sm font-medium truncate">
                      {player.nickname || player.name}
                    </span>
                    <span className="text-center text-sm text-muted-foreground">
                      {thru || "-"}
                    </span>
                    <span className="text-center text-sm font-semibold">
                      {total || "-"}
                    </span>
                    <span
                      className={`text-center text-sm font-semibold ${
                        toPar < 0
                          ? "text-red-600"
                          : toPar > 0
                            ? "text-[#555]"
                            : "text-[#006747]"
                      }`}
                    >
                      {thru > 0
                        ? toPar === 0
                          ? "E"
                          : toPar > 0
                            ? `+${toPar}`
                            : toPar
                        : "-"}
                    </span>
                  </div>
                );
              })}
          </div>
        </>
      )}

      {/* Edit Group Modal */}
      {showEditGroup && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center">
          <div className="w-full max-w-lg bg-white rounded-t-2xl p-4 pb-8 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[#006747]">Edit Group</h3>
              <button
                onClick={() => setShowEditGroup(false)}
                className="text-sm text-muted-foreground"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Tap players to add or remove from your group
            </p>
            <div className="space-y-2 mb-4">
              {players.map((player) => {
                const isSelected = editPlayerIds.includes(player.id);
                return (
                  <button
                    key={player.id}
                    onClick={() => {
                      setEditPlayerIds((prev) =>
                        isSelected
                          ? prev.filter((p) => p !== player.id)
                          : [...prev, player.id]
                      );
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors",
                      isSelected
                        ? "border-[#006747] bg-[#006747]/5"
                        : "border-[#d4e4db] bg-white"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center",
                      isSelected ? "border-[#006747] bg-[#006747]" : "border-gray-300"
                    )}>
                      {isSelected && <span className="text-white text-xs font-bold">✓</span>}
                    </div>
                    <span className="text-lg">{player.avatarEmoji || "🏌️"}</span>
                    <span className="font-medium text-[#006747]">
                      {player.nickname || player.name}
                    </span>
                  </button>
                );
              })}
            </div>
            <Button
              onClick={async () => {
                // Update the group
                const myGroup = localStorage.getItem(`stake18-my-group-${id}`);
                if (myGroup) {
                  const parsed = JSON.parse(myGroup);
                  await fetch("/api/join", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      scorerGroupId: parsed.scorerGroupId,
                      groupId: parsed.groupId,
                      playerIds: editPlayerIds,
                    }),
                  });
                  // Update localStorage
                  localStorage.setItem(
                    `stake18-my-group-${id}`,
                    JSON.stringify({ ...parsed, playerIds: editPlayerIds })
                  );
                }
                // Update local state
                if (selectedGroupId !== null) {
                  setGroupPlayerMap((prev) => ({
                    ...prev,
                    [selectedGroupId]: editPlayerIds,
                  }));
                }
                setShowEditGroup(false);
                toast.success("Group updated");
                fetchData();
              }}
              className="w-full h-12 text-lg font-semibold bg-[#006747] hover:bg-[#005538]"
              disabled={editPlayerIds.length < 2}
            >
              Save Group ({editPlayerIds.length} players)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
