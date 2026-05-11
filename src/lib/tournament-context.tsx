"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface TournamentData {
  tournament: {
    id: string;
    ownerId: string;
    name: string;
    date: string;
    buyInCents: number;
    numHoles: number;
    unclaimedRule: string;
    skinsRule: string;
    status: string;
    pin: string | null;
    leaderboardStyle: string;
    viewerIsAdmin?: boolean;
  };
  players: {
    id: number;
    tournamentId: string;
    rosterPlayerId: number;
    name: string;
    nickname: string | null;
    handicap: number;
    avatarEmoji: string | null;
  }[];
  groups: { id: number; tournamentId: string; name: string }[];
  groupPlayers: { groupId: number; playerId: number; groupName: string }[];
  courseHoles: { id: number; tournamentId: string; hole: number; par: number; hcp: number | null }[];
}

interface ScoreData {
  id: number;
  tournamentId: string;
  playerId: number;
  hole: number;
  strokes: number;
  updatedAt: string;
}

interface TournamentContextType {
  data: TournamentData | null;
  scores: ScoreData[];
  userId: string | null;
  loading: boolean;
  refreshData: () => Promise<void>;
  refreshScores: () => Promise<void>;
}

const TournamentContext = createContext<TournamentContextType>({
  data: null,
  scores: [],
  userId: null,
  loading: true,
  refreshData: async () => {},
  refreshScores: async () => {},
});

export function useTournament() {
  return useContext(TournamentContext);
}

export function TournamentProvider({
  tournamentId,
  children,
}: {
  tournamentId: string;
  children: React.ReactNode;
}) {
  const [data, setData] = useState<TournamentData | null>(null);
  const [scores, setScores] = useState<ScoreData[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshData = useCallback(async () => {
    const res = await fetch(`/api/t/${tournamentId}`);
    if (res.ok) {
      setData(await res.json());
    }
  }, [tournamentId]);

  const refreshScores = useCallback(async () => {
    const res = await fetch(`/api/t/${tournamentId}/scores`);
    if (res.ok) {
      setScores(await res.json());
    }
  }, [tournamentId]);

  useEffect(() => {
    Promise.all([refreshData(), refreshScores()]).then(() => setLoading(false));

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });

    // Real-time score updates
    const channel = supabase
      .channel(`tournament-${tournamentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scores", filter: `tournament_id=eq.${tournamentId}` },
        () => refreshScores()
      )
      .subscribe();

    // Poll tournament data every 30 seconds for admin setting changes
    const dataPoll = setInterval(() => refreshData(), 30000);

    // Aggressive score polling — keeps the leaderboard near-instant even when
    // the realtime websocket fails (common on iOS Safari and in-app browsers).
    const poll = setInterval(() => refreshScores(), 3000);

    // iOS suspends timers and websockets when a tab is backgrounded. When the
    // user returns to the tab, force an immediate refresh so they see fresh
    // scores without waiting for the next poll tick.
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshScores();
        refreshData();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
      clearInterval(dataPoll);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [tournamentId, refreshData, refreshScores]);

  return (
    <TournamentContext.Provider
      value={{ data, scores, userId, loading, refreshData, refreshScores }}
    >
      {children}
    </TournamentContext.Provider>
  );
}
