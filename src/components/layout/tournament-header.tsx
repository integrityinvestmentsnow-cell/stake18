"use client";

import Link from "next/link";
import { formatCents } from "@/lib/types";

interface TournamentHeaderProps {
  name: string;
  tournamentId: string;
  playerCount: number;
  buyInCents: number;
  status: string;
  isOwner: boolean;
}

export function TournamentHeader({
  name,
  tournamentId,
  playerCount,
  buyInCents,
  status,
  isOwner,
}: TournamentHeaderProps) {
  const totalPot = buyInCents * playerCount;

  return (
    <header className="sticky top-0 bg-[#006747] z-40 px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between max-w-lg mx-auto">
        <div>
          <h1 className="font-bold text-lg leading-tight text-white">{name}</h1>
          <div className="flex items-center gap-3 text-xs text-white/70">
            <span>{playerCount} players</span>
            <span className="text-white font-semibold">
              Pot: {formatCents(totalPot)}
            </span>
            {status === "active" && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                Live
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && (
            <Link
              href={`/t/${tournamentId}/admin`}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-white"
            >
              ⚙️
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
