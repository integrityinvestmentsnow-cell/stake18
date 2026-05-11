"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function TournamentPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [tournamentName, setTournamentName] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/t/${id}`);
    if (res.ok) {
      const data = await res.json();
      setTournamentName(data.tournament.name);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleScoreClick() {
    // If the user already joined via PIN earlier, jump straight to their
    // scorecard. Otherwise send them to the PIN entry page — scoring is
    // gated by the commissioner's PIN, not by URL access.
    const myGroup = localStorage.getItem(`stake18-my-group-${id}`);
    if (myGroup) {
      router.push(`/t/${id}/scorecard`);
    } else {
      router.push("/join");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

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
          Score with PIN
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
