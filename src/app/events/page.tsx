"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { formatCents } from "@/lib/types";

interface Event {
  id: string;
  name: string;
  date: string;
  status: string;
  buyInCents: number;
  playerCount: number;
  hasPin: boolean;
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/events")
      .then((res) => res.json())
      .then((data) => {
        setEvents(data);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Loading events...</p>
      </main>
    );
  }

  return (
    <main className="flex-1 px-4 py-8 max-w-lg mx-auto">
      <Link href="/" className="text-2xl font-bold mb-6 block text-center">
        <span className="text-[#006747]">Stake</span>
        <span className="text-[#1a3c2a]">18</span>
      </Link>

      <h2 className="text-xl font-bold text-[#006747] mb-1">
        Today&apos;s Events
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        {new Date().toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
      </p>

      {events.length === 0 ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <p className="text-2xl mb-2">⛳</p>
            <p className="text-muted-foreground">
              No events today. Check back later!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <Link key={event.id} href={`/t/${event.id}`}>
              <Card className="border-border hover:border-[#006747]/30 transition-colors cursor-pointer">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-bold text-[#006747]">{event.name}</p>
                    {event.status === "active" && (
                      <span className="flex items-center gap-1 text-xs text-[#006747]">
                        <span className="w-2 h-2 rounded-full bg-[#006747] animate-pulse" />
                        Live
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{event.playerCount} players</span>
                    <span>{formatCents(event.buyInCents)} buy-in</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-8 text-center">
        <Link
          href="/join"
          className="text-sm text-[#006747] font-semibold hover:underline"
        >
          Have a PIN? Join a tournament →
        </Link>
      </div>
    </main>
  );
}
