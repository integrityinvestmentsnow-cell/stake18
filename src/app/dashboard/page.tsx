"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface RosterPlayer {
  id: number;
  name: string;
  nickname: string | null;
  email: string | null;
  handicap: number;
  avatarEmoji: string | null;
}

interface CourseHoleData {
  hole: number;
  par: number;
  hcp?: number;
}

interface Course {
  id: number;
  name: string;
  num_holes: number;
  holes: CourseHoleData[];
}

interface Tournament {
  id: string;
  name: string;
  date: string;
  status: string;
  buyInCents: number;
  pin: string | null;
  playerCount: number;
}

const AVATAR_EMOJIS = ["🏌️", "⛳", "🦅", "🦈", "🔥", "🐯", "🐻", "🎯", "💎", "🌟"];

export default function DashboardPage() {
  const router = useRouter();
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [showCreateTournament, setShowCreateTournament] = useState(false);
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<RosterPlayer | null>(null);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  // Add/edit player form
  const [playerName, setPlayerName] = useState("");
  const [playerNickname, setPlayerNickname] = useState("");
  const [playerEmail, setPlayerEmail] = useState("");
  const [playerHandicap, setPlayerHandicap] = useState("0");
  const [playerEmoji, setPlayerEmoji] = useState("🏌️");

  // Create tournament form
  const [tournamentName, setTournamentName] = useState("");
  const [tournamentDate, setTournamentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [buyIn, setBuyIn] = useState("20");
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [skinsRule, setSkinsRule] = useState<"carry_over" | "no_carry">("carry_over");
  const [tournamentLocation, setTournamentLocation] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  // Add/edit course form
  const [courseName, setCourseName] = useState("");
  const [courseHoles, setCourseHoles] = useState<CourseHoleData[]>(
    Array.from({ length: 18 }, (_, i) => ({ hole: i + 1, par: 4 }))
  );
  const [showHoleHcp, setShowHoleHcp] = useState(false);

  const fetchData = useCallback(async () => {
    const [rosterRes, coursesRes, tournamentsRes] = await Promise.all([
      fetch("/api/roster"),
      fetch("/api/courses"),
      fetch("/api/tournaments/history"),
    ]);
    if (rosterRes.ok) setRoster(await rosterRes.json());
    if (coursesRes.ok) setCourses(await coursesRes.json());
    if (tournamentsRes.ok) setTournaments(await tournamentsRes.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/login");
        return;
      }
      fetchData();
    });
  }, [router, fetchData]);

  // ── Player helpers ──────────────────────────────────────
  function openEditPlayer(player: RosterPlayer) {
    setEditingPlayer(player);
    setPlayerName(player.name);
    setPlayerNickname(player.nickname || "");
    setPlayerEmail(player.email || "");
    setPlayerHandicap(String(player.handicap));
    setPlayerEmoji(player.avatarEmoji || "🏌️");
  }

  function resetPlayerForm() {
    setPlayerName("");
    setPlayerNickname("");
    setPlayerEmail("");
    setPlayerHandicap("0");
    setPlayerEmoji("🏌️");
    setEditingPlayer(null);
  }

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/roster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: playerName,
        nickname: playerNickname || null,
        email: playerEmail || null,
        handicap: parseInt(playerHandicap) || 0,
        avatarEmoji: playerEmoji,
      }),
    });
    if (res.ok) {
      resetPlayerForm();
      setShowAddPlayer(false);
      fetchData();
    }
  }

  async function updatePlayer(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPlayer) return;
    const res = await fetch("/api/roster", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingPlayer.id,
        name: playerName,
        nickname: playerNickname || null,
        email: playerEmail || null,
        handicap: parseInt(playerHandicap) || 0,
        avatarEmoji: playerEmoji,
      }),
    });
    if (res.ok) {
      resetPlayerForm();
      fetchData();
    }
  }

  // ── Course helpers ──────────────────────────────────────
  function openEditCourse(course: Course) {
    setEditingCourse(course);
    setCourseName(course.name);
    const holes: CourseHoleData[] = course.holes.length > 0
      ? course.holes
      : Array.from({ length: course.num_holes }, (_, i) => ({ hole: i + 1, par: 4 }));
    setCourseHoles(holes);
    setShowHoleHcp(holes.some((h) => h.hcp && h.hcp > 0));
  }

  function resetCourseForm() {
    setCourseName("");
    setCourseHoles(Array.from({ length: 18 }, (_, i) => ({ hole: i + 1, par: 4 })));
    setShowHoleHcp(false);
    setEditingCourse(null);
  }

  function updateHolePar(hole: number, par: number) {
    setCourseHoles((prev) =>
      prev.map((h) => (h.hole === hole ? { ...h, par } : h))
    );
  }

  function updateHoleHcp(hole: number, hcp: number) {
    setCourseHoles((prev) =>
      prev.map((h) => (h.hole === hole ? { ...h, hcp } : h))
    );
  }

  async function saveCourse(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: courseName,
      numHoles: courseHoles.length,
      holes: courseHoles,
    };

    if (editingCourse) {
      await fetch("/api/courses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingCourse.id, ...payload }),
      });
    } else {
      await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    resetCourseForm();
    setShowAddCourse(false);
    fetchData();
  }

  async function deleteCourse(id: number) {
    await fetch(`/api/courses?id=${id}`, { method: "DELETE" });
    fetchData();
  }

  // ── Tournament helpers ──────────────────────────────────
  function togglePlayer(id: number) {
    setSelectedPlayers((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  async function createTournament(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);

    const selectedCourse = courses.find((c) => c.id === selectedCourseId);

    const res = await fetch("/api/tournaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: tournamentName,
        date: tournamentDate,
        buyInCents: parseInt(buyIn) * 100,
        numHoles: selectedCourse?.num_holes || 18,
        courseId: selectedCourseId,
        courseHoles: selectedCourse?.holes,
        skinsRule,
        location: tournamentLocation || null,
        isPublic,
      }),
    });

    if (!res.ok) {
      setCreating(false);
      return;
    }
    const { id } = await res.json();

    for (const rosterPlayerId of selectedPlayers) {
      await fetch(`/api/t/${id}/admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_player", rosterPlayerId }),
      });
    }

    router.push(`/t/${id}/admin`);
  }

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </main>
    );
  }

  // ── Player form fields (shared between add & edit) ─────
  const playerFormFields = (
    <>
      <div className="space-y-2">
        <Label>Name *</Label>
        <Input
          placeholder="John Smith"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          required
          className="bg-background"
        />
      </div>
      <div className="space-y-2">
        <Label>Nickname (optional)</Label>
        <Input
          placeholder="Leave blank if none"
          value={playerNickname}
          onChange={(e) => setPlayerNickname(e.target.value)}
          className="bg-background"
        />
      </div>
      <div className="space-y-2">
        <Label>Email (optional)</Label>
        <Input
          type="email"
          placeholder="john@example.com"
          value={playerEmail}
          onChange={(e) => setPlayerEmail(e.target.value)}
          className="bg-background"
        />
      </div>
      <div className="space-y-2">
        <Label>Handicap</Label>
        <Input
          type="number"
          value={playerHandicap}
          onChange={(e) => setPlayerHandicap(e.target.value)}
          min="0"
          max="54"
          className="bg-background"
        />
      </div>
      <div className="space-y-2">
        <Label>Avatar</Label>
        <div className="flex gap-2 flex-wrap">
          {AVATAR_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setPlayerEmoji(emoji)}
              className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-all ${
                playerEmoji === emoji
                  ? "bg-primary/20 border-2 border-primary"
                  : "bg-background border border-border hover:border-muted-foreground"
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </>
  );

  return (
    <main className="flex-1 px-4 py-8 max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <Link href="/">
          <h1 className="text-2xl font-bold">
            <span className="text-primary">Stake</span>
            <span className="text-foreground">18</span>
          </h1>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            const supabase = createClient();
            await supabase.auth.signOut();
            router.push("/");
          }}
        >
          Sign out
        </Button>
      </div>

      {/* Create Tournament */}
      <Dialog open={showCreateTournament} onOpenChange={setShowCreateTournament}>
        <DialogTrigger render={<button type="button" />} className="w-full h-14 text-lg font-semibold mb-8 inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer">
          Create Tournament
        </DialogTrigger>
        <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Tournament</DialogTitle>
          </DialogHeader>
          <form onSubmit={createTournament} className="space-y-4">
            <div className="space-y-2">
              <Label>Tournament Name</Label>
              <Input
                placeholder="Saturday Skins"
                value={tournamentName}
                onChange={(e) => setTournamentName(e.target.value)}
                required
                className="bg-background"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={tournamentDate}
                  onChange={(e) => setTournamentDate(e.target.value)}
                  required
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>Buy-in ($)</Label>
                <Input
                  type="number"
                  value={buyIn}
                  onChange={(e) => setBuyIn(e.target.value)}
                  min="0"
                  className="bg-background"
                />
              </div>
            </div>

            {/* Skins Rule */}
            <div className="space-y-2">
              <Label>Skins Rule</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSkinsRule("carry_over")}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    skinsRule === "carry_over"
                      ? "border-[#006747] bg-[#006747]/5"
                      : "border-border bg-background hover:border-[#006747]/30"
                  }`}
                >
                  <p className="font-semibold text-sm">Carry Over</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Ties carry the skin to the next hole
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setSkinsRule("no_carry")}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    skinsRule === "no_carry"
                      ? "border-[#006747] bg-[#006747]/5"
                      : "border-border bg-background hover:border-[#006747]/30"
                  }`}
                >
                  <p className="font-semibold text-sm">All Tie, All Die</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Ties mean no one wins that skin
                  </p>
                </button>
              </div>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label>Location (optional)</Label>
              <Input
                placeholder="e.g. Windsor, Ontario"
                value={tournamentLocation}
                onChange={(e) => setTournamentLocation(e.target.value)}
                className="bg-background"
              />
            </div>

            {/* Public visibility */}
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">Public Event</p>
                <p className="text-xs text-muted-foreground">
                  Show on Today&apos;s Events so anyone can follow
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPublic(!isPublic)}
                className={cn(
                  "w-11 h-6 rounded-full transition-colors relative",
                  isPublic ? "bg-[#006747]" : "bg-gray-300"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
                    isPublic ? "translate-x-5.5" : "translate-x-0.5"
                  )}
                />
              </button>
            </div>

            {/* Course Selection */}
            <div className="space-y-2">
              <Label>Course</Label>
              {courses.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No saved courses. Add one below first, or pars default to 4.
                </p>
              ) : (
                <div className="space-y-2">
                  {courses.map((course) => (
                    <button
                      key={course.id}
                      type="button"
                      onClick={() =>
                        setSelectedCourseId(
                          selectedCourseId === course.id ? null : course.id
                        )
                      }
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                        selectedCourseId === course.id
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background hover:border-muted-foreground"
                      }`}
                    >
                      <span className="text-lg">⛳</span>
                      <div className="flex-1">
                        <p className="font-medium">{course.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {course.num_holes} holes — Par{" "}
                          {course.holes.reduce((s, h) => s + h.par, 0)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Player Selection */}
            <div className="space-y-2">
              <Label>Select Players ({selectedPlayers.length} selected)</Label>
              {roster.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Add players to your roster first
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
                  {roster.map((player) => (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => togglePlayer(player.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                        selectedPlayers.includes(player.id)
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background hover:border-muted-foreground"
                      }`}
                    >
                      <span className="text-xl">
                        {player.avatarEmoji || "🏌️"}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium">{player.name}</p>
                        {player.nickname && (
                          <p className="text-xs text-muted-foreground">
                            &quot;{player.nickname}&quot;
                          </p>
                        )}
                      </div>
                      <Badge variant="secondary">HCP {player.handicap}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-[#006747] hover:bg-[#005538]"
              disabled={selectedPlayers.length < 2 || creating}
            >
              {creating ? "Creating..." : "Create Tournament"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* My Tournaments */}
      {tournaments.length > 0 && (
        <div className="space-y-4 mb-8">
          <h2 className="text-xl font-semibold">My Tournaments</h2>
          <div className="space-y-2">
            {tournaments.map((t) => (
              <Card key={t.id} className="border-border hover:border-[#006747]/30 transition-colors cursor-pointer mb-2">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <Link href={`/t/${t.id}/admin`} className="flex-1">
                      <p className="font-semibold text-[#006747]">{t.name}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span>{t.date}</span>
                        <span>{t.playerCount} players</span>
                        {t.pin && <span>PIN: {t.pin}</span>}
                      </div>
                    </Link>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[10px]",
                          t.status === "active"
                            ? "bg-[#006747]/10 text-[#006747]"
                            : t.status === "finalized"
                              ? "bg-gray-100 text-gray-500"
                              : "bg-[#f2f7f4] text-[#006747]/60"
                        )}
                      >
                        {t.status === "active" ? "Live" : t.status === "finalized" ? "Done" : "Setup"}
                      </Badge>
                      <button
                        onClick={async (e) => {
                          e.preventDefault();
                          if (confirm("Delete this tournament?")) {
                            await fetch(`/api/tournaments?id=${t.id}`, { method: "DELETE" });
                            fetchData();
                          }
                        }}
                        className="text-xs text-muted-foreground hover:text-red-500 px-1"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* My Courses */}
      <div className="space-y-4 mb-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">My Courses</h2>
          <Dialog
            open={showAddCourse}
            onOpenChange={(open) => {
              setShowAddCourse(open);
              if (!open) resetCourseForm();
            }}
          >
            <DialogTrigger render={<button type="button" />} className="inline-flex items-center justify-center rounded-md bg-secondary text-secondary-foreground text-sm px-3 h-8 hover:bg-secondary/80 transition-colors cursor-pointer">
              + Add Course
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingCourse ? "Edit Course" : "Add Course"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={saveCourse} className="space-y-4">
                <div className="space-y-2">
                  <Label>Course Name *</Label>
                  <Input
                    placeholder="Pebble Beach"
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    required
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hole Pars</Label>
                  <p className="text-xs text-muted-foreground">Front 9</p>
                  <div className="grid grid-cols-9 gap-1">
                    {courseHoles.slice(0, 9).map((h) => (
                      <div key={h.hole} className="text-center">
                        <p className="text-[10px] text-muted-foreground mb-1">{h.hole}</p>
                        <select
                          value={h.par}
                          onChange={(e) => updateHolePar(h.hole, parseInt(e.target.value))}
                          className="w-full h-8 text-sm bg-background border border-border rounded text-center text-foreground"
                        >
                          <option value={3}>3</option>
                          <option value={4}>4</option>
                          <option value={5}>5</option>
                        </select>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground pt-2">Back 9</p>
                  <div className="grid grid-cols-9 gap-1">
                    {courseHoles.slice(9, 18).map((h) => (
                      <div key={h.hole} className="text-center">
                        <p className="text-[10px] text-muted-foreground mb-1">{h.hole}</p>
                        <select
                          value={h.par}
                          onChange={(e) => updateHolePar(h.hole, parseInt(e.target.value))}
                          className="w-full h-8 text-sm bg-background border border-border rounded text-center text-foreground"
                        >
                          <option value={3}>3</option>
                          <option value={4}>4</option>
                          <option value={5}>5</option>
                        </select>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground text-right">
                    Total Par: {courseHoles.reduce((s, h) => s + h.par, 0)}
                  </p>
                </div>

                {/* Hole Handicaps (optional) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Hole Handicaps</Label>
                    <button
                      type="button"
                      onClick={() => setShowHoleHcp(!showHoleHcp)}
                      className="text-xs text-[#006747] font-semibold"
                    >
                      {showHoleHcp ? "Hide" : "Add Hole Handicaps"}
                    </button>
                  </div>
                  {!showHoleHcp && (
                    <p className="text-xs text-muted-foreground">
                      Optional — used for net scoring and stroke allocation
                    </p>
                  )}
                  {showHoleHcp && (
                    <>
                      <p className="text-xs text-muted-foreground">
                        Enter the handicap ranking for each hole (1 = hardest, 18 = easiest)
                      </p>
                      <p className="text-xs text-muted-foreground">Front 9</p>
                      <div className="grid grid-cols-9 gap-1">
                        {courseHoles.slice(0, 9).map((h) => (
                          <div key={h.hole} className="text-center">
                            <p className="text-[10px] text-muted-foreground mb-1">{h.hole}</p>
                            <input
                              type="number"
                              min={1}
                              max={18}
                              value={h.hcp || ""}
                              onChange={(e) =>
                                updateHoleHcp(h.hole, parseInt(e.target.value) || 0)
                              }
                              placeholder="-"
                              className="w-full h-8 text-sm bg-background border border-border rounded text-center text-foreground"
                            />
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground pt-2">Back 9</p>
                      <div className="grid grid-cols-9 gap-1">
                        {courseHoles.slice(9, 18).map((h) => (
                          <div key={h.hole} className="text-center">
                            <p className="text-[10px] text-muted-foreground mb-1">{h.hole}</p>
                            <input
                              type="number"
                              min={1}
                              max={18}
                              value={h.hcp || ""}
                              onChange={(e) =>
                                updateHoleHcp(h.hole, parseInt(e.target.value) || 0)
                              }
                              placeholder="-"
                              className="w-full h-8 text-sm bg-background border border-border rounded text-center text-foreground"
                            />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <Button type="submit" className="w-full">
                  {editingCourse ? "Save Changes" : "Save Course"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {courses.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="py-8 text-center">
              <p className="text-2xl mb-2">⛳</p>
              <p className="text-muted-foreground text-sm">
                Save your courses so you don&apos;t have to set pars every time.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {courses.map((course) => (
              <Card
                key={course.id}
                className="bg-card border-border cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => {
                  openEditCourse(course);
                  setShowAddCourse(true);
                }}
              >
                <CardContent className="flex items-center gap-3 py-3">
                  <span className="text-xl">⛳</span>
                  <div className="flex-1">
                    <p className="font-medium">{course.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {course.num_holes} holes — Par{" "}
                      {course.holes.reduce((s, h) => s + h.par, 0)}
                      {course.holes.some((h) => h.hcp) && " — HCP ✓"}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteCourse(course.id);
                    }}
                    className="text-xs text-muted-foreground hover:text-destructive px-2 py-1"
                  >
                    Delete
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Roster */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Your Roster</h2>
          <Dialog open={showAddPlayer} onOpenChange={setShowAddPlayer}>
            <DialogTrigger render={<button type="button" />} className="inline-flex items-center justify-center rounded-md bg-secondary text-secondary-foreground text-sm px-3 h-8 hover:bg-secondary/80 transition-colors cursor-pointer">
              + Add Player
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle>Add Player to Roster</DialogTitle>
              </DialogHeader>
              <form onSubmit={addPlayer} className="space-y-4">
                {playerFormFields}
                <Button type="submit" className="w-full">
                  Add to Roster
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {roster.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="py-12 text-center">
              <p className="text-4xl mb-3">🏌️</p>
              <p className="text-muted-foreground">
                No players yet. Add your golf buddies to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {roster.map((player) => (
              <Card
                key={player.id}
                className="bg-card border-border cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => openEditPlayer(player)}
              >
                <CardContent className="flex items-center gap-3 py-3">
                  <span className="text-2xl">
                    {player.avatarEmoji || "🏌️"}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium">{player.name}</p>
                    {player.nickname && (
                      <p className="text-sm text-muted-foreground">
                        &quot;{player.nickname}&quot;
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary">HCP {player.handicap}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Edit Player Dialog */}
      <Dialog
        open={editingPlayer !== null}
        onOpenChange={(open) => {
          if (!open) resetPlayerForm();
        }}
      >
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Edit Player</DialogTitle>
          </DialogHeader>
          <form onSubmit={updatePlayer} className="space-y-4">
            {playerFormFields}
            <Button type="submit" className="w-full">
              Save Changes
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
