"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface Player {
  id: number;
  name: string;
  nickname: string | null;
  avatarEmoji: string | null;
}

interface TournamentInfo {
  id: string;
  name: string;
  date: string;
  buyInCents: number;
  status: string;
}

export default function JoinWithPinPage() {
  const params = useParams();
  const router = useRouter();
  const pin = params.pin as string;

  const [tournament, setTournament] = useState<TournamentInfo | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function lookup() {
      try {
        const res = await fetch(`/api/join?pin=${pin}`, {
          credentials: "same-origin",
          redirect: "follow",
        });
        if (!res.ok) {
          setError("Invalid PIN. Please check and try again.");
          setLoading(false);
          return;
        }
        const data = await res.json();
        setTournament(data.tournament);
        setPlayers(data.players);
      } catch {
        setError("Connection error. Please try again.");
      }
      setLoading(false);
    }
    lookup();
  }, [pin]);

  function togglePlayer(playerId: number) {
    setSelectedPlayerIds((prev) =>
      prev.includes(playerId)
        ? prev.filter((p) => p !== playerId)
        : [...prev, playerId]
    );
  }

  async function createScorerGroup() {
    if (!tournament || selectedPlayerIds.length === 0) return;
    setSubmitting(true);

    let scorerId = localStorage.getItem("stake18-scorer-id");
    if (!scorerId) {
      scorerId = crypto.randomUUID();
      localStorage.setItem("stake18-scorer-id", scorerId);
    }

    const res = await fetch("/api/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        tournamentId: tournament.id,
        playerIds: selectedPlayerIds,
        scorerId,
      }),
    });

    if (res.ok) {
      const group = await res.json();
      localStorage.setItem(
        `stake18-my-group-${tournament.id}`,
        JSON.stringify({
          scorerGroupId: group.id,
          groupId: group.groupId,
          playerIds: selectedPlayerIds,
        })
      );
      localStorage.setItem(`stake18-group-${tournament.id}`, String(group.groupId));
      router.push(`/t/${tournament.id}/scorecard`);
    } else {
      const errData = await res.json().catch(() => ({}));
      setError(errData.error || "Failed to join. Please try again.");
    }

    setSubmitting(false);
  }

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-[#006747]">Finding tournament...</p>
      </main>
    );
  }

  if (error && !tournament) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <Link href="/" className="text-2xl font-bold mb-8">
          <span className="text-[#006747]">Stake18</span>
          <span className="text-[#1a3c2a]">golf</span>
        </Link>
        <p className="text-red-600 mb-4">{error}</p>
        <Button
          onClick={() => router.push("/join")}
          className="bg-[#006747] hover:bg-[#005538]"
        >
          Enter PIN Manually
        </Button>
      </main>
    );
  }

  return (
    <main className="flex-1 px-4 py-8 max-w-md mx-auto">
      <Link href="/" className="text-xl font-bold mb-6 block text-center">
        <span className="text-[#006747]">Stake18</span>
        <span className="text-[#1a3c2a]">golf</span>
      </Link>

      <div className="bg-[#006747] text-white rounded-lg p-4 mb-6 text-center">
        <p className="font-bold text-lg">{tournament?.name}</p>
        <p className="text-white/70 text-sm">{tournament?.date}</p>
      </div>

      <h2 className="text-lg font-bold text-[#006747] mb-1">
        Select Your Players
      </h2>
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
                ? "border-[#006747] bg-[#006747]/5"
                : "border-border bg-white hover:border-[#006747]/30"
            }`}
          >
            <div
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                selectedPlayerIds.includes(player.id)
                  ? "border-[#006747] bg-[#006747]"
                  : "border-gray-300"
              }`}
            >
              {selectedPlayerIds.includes(player.id) && (
                <span className="text-white text-xs font-bold">✓</span>
              )}
            </div>
            <span className="text-lg">{player.avatarEmoji || "🏌️"}</span>
            <span className="font-semibold text-[#006747]">
              {player.nickname || player.name}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-600 text-center mb-2">{error}</p>
      )}

      <Button
        onClick={createScorerGroup}
        className="w-full h-14 text-lg font-semibold bg-[#006747] hover:bg-[#005538]"
        disabled={selectedPlayerIds.length < 2 || submitting}
      >
        {submitting
          ? "Setting up..."
          : `Start Scoring (${selectedPlayerIds.length} players)`}
      </Button>

      <p className="text-xs text-muted-foreground text-center mt-4">
        Just watching?{" "}
        <a href={`/t/${tournament?.id}/leaderboard`} className="text-[#006747] font-semibold hover:underline">
          View the Leaderboard
        </a>
      </p>
    </main>
  );
}
