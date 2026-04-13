"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, usePathname } from "next/navigation";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { TournamentHeader } from "@/components/layout/tournament-header";
import { createClient } from "@/lib/supabase/client";

interface TournamentData {
  tournament: {
    id: string;
    ownerId: string;
    name: string;
    buyInCents: number;
    status: string;
  };
  players: { id: number; name: string }[];
}

export default function TournamentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const id = params.id as string;
  const pathname = usePathname();
  const [data, setData] = useState<TournamentData | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const isLandingPage = pathname === `/t/${id}`;

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/t/${id}`);
    if (res.ok) {
      const json = await res.json();
      setData(json);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });
  }, [fetchData]);

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Loading tournament...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      {!isLandingPage && (
        <TournamentHeader
          name={data.tournament.name}
          tournamentId={id}
          playerCount={data.players.length}
          buyInCents={data.tournament.buyInCents}
          status={data.tournament.status}
          isOwner={userId === data.tournament.ownerId}
        />
      )}
      <main className="flex-1 pb-20">{children}</main>
      <BottomTabBar tournamentId={id} />
    </div>
  );
}
