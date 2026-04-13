"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { formatCents } from "@/lib/types";

interface Event {
  id: string;
  name: string;
  date: string;
  status: string;
  buyInCents: number;
  location: string | null;
  playerCount: number;
}

export default function Home() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  useEffect(() => {
    fetch("/api/events")
      .then((res) => res.json())
      .then((data) => {
        setEvents(data);
        setLoadingEvents(false);
      })
      .catch(() => setLoadingEvents(false));
  }, []);

  return (
    <main className="flex-1 px-4 py-12">
      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">
          <span className="text-[#006747]">Stake18</span>
          <span className="text-[#1a3c2a] text-2xl sm:text-3xl">golf.com</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-md mx-auto">
          Live golf skins with your crew. Score, track, and settle up — all
          from your phone.
        </p>
      </div>

      {/* Actions */}
      <div className="w-full max-w-sm mx-auto space-y-4 mb-12">
        <Button
          onClick={() => router.push("/dashboard")}
          className="w-full h-14 text-lg font-semibold bg-[#006747] hover:bg-[#005538]"
        >
          Create Tournament
        </Button>

        <Button
          onClick={() => router.push("/join")}
          variant="outline"
          className="w-full h-14 text-lg font-semibold border-[#006747] text-[#006747] hover:bg-[#006747]/5"
        >
          Enter PIN to Join
        </Button>
      </div>

      {/* Today's Events */}
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[#006747]">
            Today&apos;s Events
          </h2>
          <Link
            href="/events"
            className="text-xs text-[#006747] font-semibold hover:underline"
          >
            View all
          </Link>
        </div>

        {loadingEvents ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Loading events...
          </p>
        ) : events.length === 0 ? (
          <Card className="border-border">
            <CardContent className="py-8 text-center">
              <p className="text-2xl mb-2">⛳</p>
              <p className="text-muted-foreground text-sm">
                No public events today yet. Create one and it&apos;ll show up
                here!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <Link key={event.id} href={`/t/${event.id}/leaderboard`}>
                <Card className="border-border hover:border-[#006747]/30 transition-colors cursor-pointer mb-2">
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-[#006747] truncate">
                          {event.name}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                          {event.location && (
                            <span className="flex items-center gap-1">
                              📍 {event.location}
                            </span>
                          )}
                          <span>{event.playerCount} players</span>
                          <span>{formatCents(event.buyInCents)} buy-in</span>
                        </div>
                      </div>
                      {event.status === "active" ? (
                        <span className="flex items-center gap-1 text-xs text-[#006747] font-semibold ml-2 flex-shrink-0">
                          <span className="w-2 h-2 rounded-full bg-[#006747] animate-pulse" />
                          Live
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                          {event.status === "finalized" ? "Final" : "Starting"}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12 max-w-2xl mx-auto w-full">
        <Card className="border-border">
          <CardContent className="pt-6 text-center">
            <div className="text-3xl mb-2">🏆</div>
            <h3 className="font-semibold text-[#006747] mb-1">Live Skins</h3>
            <p className="text-sm text-muted-foreground">
              Real-time skins tracking with carryover
            </p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-6 text-center">
            <div className="text-3xl mb-2">📱</div>
            <h3 className="font-semibold text-[#006747] mb-1">Easy Scoring</h3>
            <p className="text-sm text-muted-foreground">
              Tap +/- to score your group hole by hole
            </p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-6 text-center">
            <div className="text-3xl mb-2">⛳</div>
            <h3 className="font-semibold text-[#006747] mb-1">Live Leaderboard</h3>
            <p className="text-sm text-muted-foreground">
              Anyone can watch — no account needed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Coming Soon */}
      <div className="mt-16 max-w-md mx-auto w-full">
        <h2 className="text-lg font-bold text-[#006747] text-center mb-6">
          Coming Soon
        </h2>
        <div className="space-y-3">
          {[
            {
              name: "Nassau",
              desc: "Front 9, back 9, and overall — the classic 3-bet format",
              icon: "🎰",
            },
            {
              name: "Match Play",
              desc: "Head-to-head hole-by-hole battles within your group",
              icon: "⚔️",
            },
            {
              name: "Settlement",
              desc: "One-tap Venmo & Zelle links — who owes who, instantly",
              icon: "💸",
            },
            {
              name: "Season Stats",
              desc: "Track lifetime winnings, streaks, and rivalries",
              icon: "📊",
            },
          ].map((item) => (
            <div
              key={item.name}
              className="flex items-center gap-4 px-4 py-3 rounded-xl border border-[#d4e4db] bg-[#f2f7f4]/50"
            >
              <span className="text-2xl">{item.icon}</span>
              <div>
                <p className="font-semibold text-sm text-[#006747]">
                  {item.name}
                </p>
                <p className="text-xs text-[#006747]/50">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <p className="text-xs text-muted-foreground mt-12 text-center">
        No download required. Share a PIN and play.
      </p>
    </main>
  );
}
