"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";

interface Player {
  id: number;
  name: string;
  nickname: string | null;
  handicap: number;
  avatarEmoji: string | null;
}

interface Group {
  id: number;
  name: string;
}

interface CourseHole {
  hole: number;
  par: number;
}

const AVATAR_EMOJIS = ["🏌️", "⛳", "🦅", "🦈", "🔥", "🐯", "🐻", "🎯", "💎", "🌟"];

export default function AdminPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [players, setPlayers] = useState<Player[]>([]);
  const [existingGroups, setExistingGroups] = useState<Group[]>([]);
  const [groupPlayerMap, setGroupPlayerMap] = useState<Record<number, number[]>>({});
  const [courseHoles, setCourseHoles] = useState<CourseHole[]>([]);
  const [status, setStatus] = useState("setup");
  const [tournamentPin, setTournamentPin] = useState("");
  const [skinsRule, setSkinsRule] = useState<"carry_over" | "no_carry">("carry_over");
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  // Create group
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupPlayerIds, setGroupPlayerIds] = useState<number[]>([]);

  // Edit player
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editName, setEditName] = useState("");
  const [editNickname, setEditNickname] = useState("");
  const [editHandicap, setEditHandicap] = useState("0");
  const [editEmoji, setEditEmoji] = useState("🏌️");

  // Edit group
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [editGroupName, setEditGroupName] = useState("");

  const fetchData = useCallback(async () => {
    // Check if user is the owner
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const res = await fetch(`/api/t/${id}`);
    if (res.ok) {
      const data = await res.json();
      setIsOwner(user?.id === data.tournament.ownerId);
      setPlayers(data.players);
      setExistingGroups(data.groups);
      setCourseHoles(
        data.courseHoles
          .map((h: { hole: number; par: number }) => ({ hole: h.hole, par: h.par }))
          .sort((a: CourseHole, b: CourseHole) => a.hole - b.hole)
      );
      setStatus(data.tournament.status);
      setTournamentPin(data.tournament.pin || "");
      setSkinsRule(data.tournament.skinsRule || "carry_over");

      const gpMap: Record<number, number[]> = {};
      for (const gp of data.groupPlayers) {
        if (!gpMap[gp.groupId]) gpMap[gp.groupId] = [];
        gpMap[gp.groupId].push(gp.playerId);
      }
      setGroupPlayerMap(gpMap);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function adminAction(body: Record<string, unknown>) {
    await fetch(`/api/t/${id}/admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    await adminAction({
      action: "create_group",
      name: groupName,
      playerIds: groupPlayerIds,
    });
    setGroupName("");
    setGroupPlayerIds([]);
    setShowCreateGroup(false);
    fetchData();
  }

  async function updatePar(hole: number, par: number) {
    await adminAction({ action: "update_par", hole, par });
    setCourseHoles((prev) =>
      prev.map((h) => (h.hole === hole ? { ...h, par } : h))
    );
  }

  async function startTournament() {
    await adminAction({ action: "start" });
    setStatus("active");
  }

  async function finalizeTournament() {
    await adminAction({ action: "finalize" });
    setStatus("finalized");
    router.push(`/t/${id}/recap`);
  }

  function toggleGroupPlayer(playerId: number) {
    setGroupPlayerIds((prev) =>
      prev.includes(playerId)
        ? prev.filter((p) => p !== playerId)
        : [...prev, playerId]
    );
  }

  function openEditPlayer(player: Player) {
    setEditingPlayer(player);
    setEditName(player.name);
    setEditNickname(player.nickname || "");
    setEditHandicap(String(player.handicap));
    setEditEmoji(player.avatarEmoji || "🏌️");
  }

  async function savePlayer(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPlayer) return;
    await adminAction({
      action: "edit_player",
      playerId: editingPlayer.id,
      name: editName,
      nickname: editNickname || null,
      handicap: parseInt(editHandicap) || 0,
      avatarEmoji: editEmoji,
    });
    setEditingPlayer(null);
    fetchData();
  }

  function openEditGroup(group: Group) {
    setEditingGroup(group);
    setEditGroupName(group.name);
  }

  async function saveGroupName(e: React.FormEvent) {
    e.preventDefault();
    if (!editingGroup) return;
    await adminAction({
      action: "rename_group",
      groupId: editingGroup.id,
      name: editGroupName,
    });
    setEditingGroup(null);
    fetchData();
  }

  async function removePlayerFromGroup(groupId: number, playerId: number) {
    await adminAction({
      action: "remove_player_from_group",
      groupId,
      playerId,
    });
    fetchData();
  }

  async function addPlayerToGroup(groupId: number, playerId: number) {
    await adminAction({
      action: "add_player_to_group",
      groupId,
      playerId,
    });
    fetchData();
  }

  async function deleteGroup(groupId: number) {
    await adminAction({ action: "delete_group", groupId });
    fetchData();
  }

  // Players already in a group
  const assignedPlayerIds = Object.values(groupPlayerMap).flat();
  const unassignedPlayers = players.filter(
    (p) => !assignedPlayerIds.includes(p.id)
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="px-4 py-12 max-w-md mx-auto text-center">
        <p className="text-3xl mb-3">🔒</p>
        <h2 className="text-lg font-bold text-[#006747] mb-2">Admin Only</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Only the tournament organizer can access this page.
        </p>
        <a
          href={`/t/${id}/leaderboard`}
          className="text-sm text-[#006747] font-semibold hover:underline"
        >
          View the Leaderboard →
        </a>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      <h2 className="text-xl font-bold text-[#006747]">Tournament Admin</h2>

      {/* Tournament PIN */}
      {tournamentPin && (
        <Card className="bg-[#006747] border-none">
          <CardContent className="py-5 text-center">
            <p className="text-white/70 text-xs uppercase tracking-wider font-semibold mb-1">
              Tournament PIN
            </p>
            <p className="text-4xl font-bold text-white tracking-[0.3em] mb-3">
              {tournamentPin}
            </p>
            <p className="text-white/50 text-xs">
              Share this PIN with your players
            </p>
          </CardContent>
        </Card>
      )}

      {/* Share Link */}
      <Card className="bg-card border-border">
        <CardContent className="py-3">
          <Label className="text-xs text-muted-foreground">Spectator Link</Label>
          <div className="flex items-center gap-2 mt-1">
            <Input
              readOnly
              value={`${typeof window !== "undefined" ? window.location.origin : ""}/t/${id}`}
              className="bg-background text-sm"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(
                  `${window.location.origin}/t/${id}`
                );
              }}
            >
              Copy
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Players */}
      <div className="space-y-3">
        <h3 className="font-semibold">Players</h3>
        <p className="text-xs text-muted-foreground">Tap a player to edit</p>
        <div className="space-y-1.5">
          {players.map((player) => (
            <Card
              key={player.id}
              className="bg-card border-border cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => openEditPlayer(player)}
            >
              <CardContent className="flex items-center gap-3 py-2.5">
                <span className="text-xl">{player.avatarEmoji || "🏌️"}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{player.name}</p>
                  {player.nickname && (
                    <p className="text-xs text-muted-foreground truncate">
                      &quot;{player.nickname}&quot;
                    </p>
                  )}
                </div>
                <Badge variant="secondary" className="text-xs">
                  HCP {player.handicap}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Groups */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Groups</h3>
          <Dialog open={showCreateGroup} onOpenChange={setShowCreateGroup}>
            <DialogTrigger
              render={<button type="button" />}
              className="inline-flex items-center justify-center rounded-md bg-secondary text-secondary-foreground text-sm px-3 h-8 hover:bg-secondary/80 transition-colors cursor-pointer"
            >
              + Create Group
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle>Create Group</DialogTitle>
              </DialogHeader>
              <form onSubmit={createGroup} className="space-y-4">
                <div className="space-y-2">
                  <Label>Group Name</Label>
                  <Input
                    placeholder={`Group ${existingGroups.length + 1}`}
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    required
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    Select Players (2-4) — {groupPlayerIds.length} selected
                  </Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {players.map((player) => (
                      <button
                        key={player.id}
                        type="button"
                        onClick={() => toggleGroupPlayer(player.id)}
                        className={`w-full flex items-center gap-2 p-2 rounded-lg border text-left transition-colors ${
                          groupPlayerIds.includes(player.id)
                            ? "border-primary bg-primary/10"
                            : assignedPlayerIds.includes(player.id)
                              ? "border-border bg-background opacity-40"
                              : "border-border bg-background"
                        }`}
                        disabled={
                          assignedPlayerIds.includes(player.id) &&
                          !groupPlayerIds.includes(player.id)
                        }
                      >
                        <span>{player.avatarEmoji || "🏌️"}</span>
                        <span className="flex-1 text-sm">
                          {player.nickname || player.name}
                        </span>
                        {assignedPlayerIds.includes(player.id) &&
                          !groupPlayerIds.includes(player.id) && (
                            <span className="text-[10px] text-muted-foreground">
                              in group
                            </span>
                          )}
                      </button>
                    ))}
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={groupPlayerIds.length < 2}
                >
                  Create Group
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {existingGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No groups yet. Create groups of 2-4 players.
          </p>
        ) : (
          existingGroups.map((group) => (
            <Card key={group.id} className="bg-card border-border">
              <CardHeader className="py-3 flex flex-row items-center justify-between">
                <CardTitle
                  className="text-sm cursor-pointer hover:text-primary transition-colors"
                  onClick={() => openEditGroup(group)}
                >
                  {group.name}
                </CardTitle>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => openEditGroup(group)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                    onClick={() => deleteGroup(group.id)}
                  >
                    Delete
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="space-y-1.5">
                  {(groupPlayerMap[group.id] || []).map((playerId) => {
                    const player = players.find((p) => p.id === playerId);
                    if (!player) return null;
                    return (
                      <div
                        key={playerId}
                        className="flex items-center justify-between py-1"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">
                            {player.avatarEmoji || "🏌️"}
                          </span>
                          <span className="text-sm">
                            {player.nickname || player.name}
                          </span>
                        </div>
                        <button
                          onClick={() =>
                            removePlayerFromGroup(group.id, playerId)
                          }
                          className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1"
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                  {/* Add unassigned player to this group */}
                  {unassignedPlayers.length > 0 && (
                    <div className="pt-2 border-t border-border/50">
                      <select
                        className="w-full h-8 text-sm bg-background border border-border rounded px-2 text-foreground"
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) {
                            addPlayerToGroup(group.id, Number(e.target.value));
                            e.target.value = "";
                          }
                        }}
                      >
                        <option value="" disabled>
                          + Add player...
                        </option>
                        {unassignedPlayers.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nickname || p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Skins Rule */}
      <div className="space-y-3">
        <h3 className="font-semibold">Skins Rule</h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={async () => {
              setSkinsRule("carry_over");
              await adminAction({ action: "update_skins_rule", skinsRule: "carry_over" });
            }}
            className={`p-3 rounded-lg border text-left transition-colors ${
              skinsRule === "carry_over"
                ? "border-[#006747] bg-[#006747]/5"
                : "border-border bg-background hover:border-[#006747]/30"
            }`}
          >
            <p className="font-semibold text-sm">Carry Over</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Ties carry to next hole
            </p>
          </button>
          <button
            onClick={async () => {
              setSkinsRule("no_carry");
              await adminAction({ action: "update_skins_rule", skinsRule: "no_carry" });
            }}
            className={`p-3 rounded-lg border text-left transition-colors ${
              skinsRule === "no_carry"
                ? "border-[#006747] bg-[#006747]/5"
                : "border-border bg-background hover:border-[#006747]/30"
            }`}
          >
            <p className="font-semibold text-sm">All Tie, All Die</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              No one wins on a tie
            </p>
          </button>
        </div>
      </div>

      {/* Course Pars */}
      <div className="space-y-3">
        <h3 className="font-semibold">Course Pars</h3>
        <div className="grid grid-cols-9 gap-1">
          {courseHoles.slice(0, 9).map((h) => (
            <div key={h.hole} className="text-center">
              <p className="text-[10px] text-muted-foreground mb-1">{h.hole}</p>
              <select
                value={h.par}
                onChange={(e) => updatePar(h.hole, parseInt(e.target.value))}
                className="w-full h-8 text-sm bg-card border border-border rounded text-center text-foreground"
              >
                <option value={3}>3</option>
                <option value={4}>4</option>
                <option value={5}>5</option>
              </select>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-9 gap-1">
          {courseHoles.slice(9, 18).map((h) => (
            <div key={h.hole} className="text-center">
              <p className="text-[10px] text-muted-foreground mb-1">{h.hole}</p>
              <select
                value={h.par}
                onChange={(e) => updatePar(h.hole, parseInt(e.target.value))}
                className="w-full h-8 text-sm bg-card border border-border rounded text-center text-foreground"
              >
                <option value={3}>3</option>
                <option value={4}>4</option>
                <option value={5}>5</option>
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3 pt-4">
        {status === "setup" && (
          <Button
            onClick={startTournament}
            className="w-full h-12 text-lg bg-[#006747] hover:bg-[#005538]"
          >
            Start Tournament
          </Button>
        )}
        {status === "active" && (
          <Button
            onClick={finalizeTournament}
            variant="destructive"
            className="w-full h-12"
          >
            Finalize Tournament
          </Button>
        )}
        {status === "finalized" && (
          <p className="text-center text-muted-foreground">
            Tournament finalized
          </p>
        )}
      </div>

      {/* Edit Player Dialog */}
      <Dialog
        open={editingPlayer !== null}
        onOpenChange={(open) => {
          if (!open) setEditingPlayer(null);
        }}
      >
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Edit Player</DialogTitle>
          </DialogHeader>
          <form onSubmit={savePlayer} className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label>Nickname (optional)</Label>
              <Input
                placeholder="Leave blank if none"
                value={editNickname}
                onChange={(e) => setEditNickname(e.target.value)}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label>Handicap</Label>
              <Input
                type="number"
                value={editHandicap}
                onChange={(e) => setEditHandicap(e.target.value)}
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
                    onClick={() => setEditEmoji(emoji)}
                    className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-all ${
                      editEmoji === emoji
                        ? "bg-primary/20 border-2 border-primary"
                        : "bg-background border border-border hover:border-muted-foreground"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full">
              Save Changes
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Group Dialog */}
      <Dialog
        open={editingGroup !== null}
        onOpenChange={(open) => {
          if (!open) setEditingGroup(null);
        }}
      >
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Rename Group</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveGroupName} className="space-y-4">
            <div className="space-y-2">
              <Label>Group Name</Label>
              <Input
                value={editGroupName}
                onChange={(e) => setEditGroupName(e.target.value)}
                required
                className="bg-background"
              />
            </div>
            <Button type="submit" className="w-full">
              Save
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
