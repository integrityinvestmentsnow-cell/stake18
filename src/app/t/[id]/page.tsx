"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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

export default function TournamentPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [players, setPlayers] = useState<Player[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupPlayerMap, setGroupPlayerMap] = useState<
    Record<number, number[]>
  >({});
  const [tournamentName, setTournamentName] = useState("");
  const [loading, setLoading] = useState(true);

  // Player selection for ad-hoc scoring (when no groups exist)
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>([]);
  const [mode, setMode] = useState<"choose" | "pick-group" | "pick-players">(
    "choose"
  );

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/t/${id}`);
    if (res.ok) {
      const data = await res.json();
      setPlayers(data.players);
      setGroups(data.groups);
      setTournamentName(data.tournament.name);

      const gpMap: Record<number, number[]> = {};
      for (const gp of data.groupPlayers) {
        if (!gpMap[gp.groupId]) gpMap[gp.groupId] = [];
        gpMap[gp.groupId].push(gp.playerId);
      }
      setGroupPlayerMap(gpMap);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function selectGroup(groupId: number) {
    const playerIds = groupPlayerMap[groupId] || [];
    localStorage.setItem(`stake18-group-${id}`, String(groupId));
    localStorage.setItem(
      `stake18-my-group-${id}`,
      JSON.stringify({ scorerGroupId: groupId, playerIds })
    );
    router.push(`/t/${id}/scorecard`);
  }

  function togglePlayer(playerId: number) {
    setSelectedPlayerIds((prev) =>
      prev.includes(playerId)
        ? prev.filter((p) => p !== playerId)
        : [...prev, playerId]
    );
  }

  function startScoringSelected() {
    localStorage.setItem(
      `stake18-my-group-${id}`,
      JSON.stringify({ scorerGroupId: -1, playerIds: selectedPlayerIds })
    );
    router.push(`/t/${id}/scorecard`);
  }

  function handleScoreClick() {
    // Check if user already has a "My Group" from PIN flow
    const myGroup = localStorage.getItem(`stake18-my-group-${id}`);
    if (myGroup) {
      router.push(`/t/${id}/scorecard`);
      return;
    }
    if (groups.length > 0) {
      setMode("pick-group");
    } else {
      setMode("pick-players");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Main choice screen
  if (mode === "choose") {
    return (
      <div className="px-4 py-12 max-w-md mx-auto flex flex-col items-center gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-1">
            <span className="text-primary">Stake</span>
            <span className="text-foreground">18</span>
          </h1>
          <p className="text-lg font-semibold text-foreground">
            {tournamentName}
          </p>
        </div>

        <div className="w-full space-y-4 mt-4">
          <Button
            onClick={handleScoreClick}
            className="w-full h-16 text-lg font-semibold rounded-xl"
          >
            Score for Your Group
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push(`/t/${id}/leaderboard`)}
            className="w-full h-16 text-lg font-semibold rounded-xl"
          >
            Watch the Leaderboard
          </Button>
        </div>
      </div>
    );
  }

  // Pick a group
  if (mode === "pick-group") {
    return (
      <div className="px-4 py-8 max-w-md mx-auto">
        <button
          onClick={() => setMode("choose")}
          className="text-sm text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1"
        >
          &larr; Back
        </button>
        <h2 className="text-lg font-bold mb-2">Select Your Group</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Pick the group you&apos;re scoring for
        </p>

        <div className="space-y-3">
          {groups.map((group) => {
            const playerIds = groupPlayerMap[group.id] || [];
            const groupPlayers = players.filter((p) =>
              playerIds.includes(p.id)
            );

            return (
              <Card
                key={group.id}
                className="bg-card border-border cursor-pointer hover:border-primary/50 transition-colors active:scale-[0.98]"
                onClick={() => selectGroup(group.id)}
              >
                <CardContent className="py-4">
                  <p className="font-semibold mb-2">{group.name}</p>
                  <div className="flex flex-wrap gap-2">
                    {groupPlayers.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-2.5 py-1.5"
                      >
                        <span className="text-sm">
                          {p.avatarEmoji || "🏌️"}
                        </span>
                        <span className="text-sm font-medium">
                          {p.nickname || p.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // Pick players (no groups set up)
  return (
    <div className="px-4 py-8 max-w-md mx-auto">
      <button
        onClick={() => setMode("choose")}
        className="text-sm text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1"
      >
        &larr; Back
      </button>
      <h2 className="text-lg font-bold mb-2">Select Players to Score</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Pick the players in your group
      </p>

      <div className="space-y-2 mb-6">
        {players.map((player) => (
          <button
            key={player.id}
            onClick={() => togglePlayer(player.id)}
            className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
              selectedPlayerIds.includes(player.id)
                ? "border-primary bg-primary/10"
                : "border-border bg-card hover:border-muted-foreground"
            }`}
          >
            <div
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                selectedPlayerIds.includes(player.id)
                  ? "border-primary bg-primary"
                  : "border-muted-foreground"
              }`}
            >
              {selectedPlayerIds.includes(player.id) && (
                <span className="text-primary-foreground text-xs font-bold">
                  ✓
                </span>
              )}
            </div>
            <span className="text-lg">{player.avatarEmoji || "🏌️"}</span>
            <span className="font-medium">
              {player.nickname || player.name}
            </span>
          </button>
        ))}
      </div>

      <Button
        onClick={startScoringSelected}
        className="w-full h-14 text-lg font-semibold rounded-xl"
        disabled={selectedPlayerIds.length < 2}
      >
        Start Scoring ({selectedPlayerIds.length} players)
      </Button>
    </div>
  );
}
