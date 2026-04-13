"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

export default function JoinPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Step 2: pick players
  const [tournament, setTournament] = useState<TournamentInfo | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function lookupPin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch(`/api/join?pin=${pin}`);
    if (!res.ok) {
      setError("Invalid PIN. Please try again.");
      setLoading(false);
      return;
    }

    const data = await res.json();
    setTournament(data.tournament);
    setPlayers(data.players);
    setLoading(false);
  }

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

    // Generate a unique scorer ID for this device
    let scorerId = localStorage.getItem("stake18-scorer-id");
    if (!scorerId) {
      scorerId = crypto.randomUUID();
      localStorage.setItem("stake18-scorer-id", scorerId);
    }

    const res = await fetch("/api/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tournamentId: tournament.id,
        playerIds: selectedPlayerIds,
        scorerId,
      }),
    });

    if (res.ok) {
      const group = await res.json();
      // Store the scorer group + skins group for "My Group" tab
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
    }

    setSubmitting(false);
  }

  // Step 1: Enter PIN
  if (!tournament) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <Link href="/" className="text-2xl font-bold mb-8">
          <span className="text-[#006747]">Stake</span>
          <span className="text-[#1a3c2a]">18</span>
        </Link>

        <h2 className="text-lg font-bold text-[#006747] mb-1">
          Enter Tournament PIN
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Get the PIN from your tournament organizer
        </p>

        <form onSubmit={lookupPin} className="w-full max-w-xs space-y-4">
          <div className="space-y-2">
            <Label>PIN</Label>
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="Enter PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="text-center text-2xl tracking-[0.5em] font-bold h-14 bg-[#f2f7f4]"
              required
            />
          </div>
          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          <Button
            type="submit"
            className="w-full h-12 text-lg font-semibold bg-[#006747] hover:bg-[#005538]"
            disabled={loading || pin.length < 4}
          >
            {loading ? "Looking up..." : "Submit"}
          </Button>
        </form>
      </main>
    );
  }

  // Step 2: Select players
  return (
    <main className="flex-1 px-4 py-8 max-w-md mx-auto">
      <Link href="/" className="text-xl font-bold mb-6 block text-center">
        <span className="text-[#006747]">Stake</span>
        <span className="text-[#1a3c2a]">18</span>
      </Link>

      <div className="bg-[#006747] text-white rounded-lg p-4 mb-6 text-center">
        <p className="font-bold text-lg">{tournament.name}</p>
        <p className="text-white/70 text-sm">{tournament.date}</p>
      </div>

      <h2 className="text-lg font-bold text-[#006747] mb-1">
        Select Players to Score
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

      <Button
        onClick={createScorerGroup}
        className="w-full h-14 text-lg font-semibold bg-[#006747] hover:bg-[#005538]"
        disabled={selectedPlayerIds.length < 2 || submitting}
      >
        {submitting
          ? "Setting up..."
          : `Start Scoring (${selectedPlayerIds.length} players)`}
      </Button>
    </main>
  );
}
