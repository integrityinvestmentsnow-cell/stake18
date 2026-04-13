"use client";

import { useParams, usePathname } from "next/navigation";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { TournamentHeader } from "@/components/layout/tournament-header";
import { TournamentProvider, useTournament } from "@/lib/tournament-context";

function TournamentLayoutInner({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const id = params.id as string;
  const { data, userId, loading } = useTournament();
  const isLandingPage = pathname === `/t/${id}`;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Tournament not found</p>
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

export default function TournamentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const id = params.id as string;

  return (
    <TournamentProvider tournamentId={id}>
      <TournamentLayoutInner>{children}</TournamentLayoutInner>
    </TournamentProvider>
  );
}
