export interface LeaderboardEntry {
  playerId: number;
  name: string;
  nickname: string | null;
  avatarEmoji: string;
  totalStrokes: number;
  holesCompleted: number;
  toPar: number;
  groupId: number | null;
  groupName: string | null;
}

export interface PlayerScoreData {
  playerId: number;
  name: string;
  nickname: string | null;
  avatarEmoji: string;
  groupId: number | null;
  groupName: string | null;
  scores: { hole: number; strokes: number }[];
}

export function computeLeaderboard(
  players: PlayerScoreData[],
  coursePars: Record<number, number> // hole -> par
): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = players.map((player) => {
    const totalStrokes = player.scores.reduce((sum, s) => sum + s.strokes, 0);
    const holesCompleted = player.scores.length;

    // Calculate to-par using only holes that have been played
    const parForPlayedHoles = player.scores.reduce(
      (sum, s) => sum + (coursePars[s.hole] || 4),
      0
    );
    const toPar = totalStrokes - parForPlayedHoles;

    return {
      playerId: player.playerId,
      name: player.name,
      nickname: player.nickname,
      avatarEmoji: player.avatarEmoji || "🏌️",
      totalStrokes,
      holesCompleted,
      toPar,
      groupId: player.groupId,
      groupName: player.groupName,
    };
  });

  // Sort PGA-style: lowest to-par first; holes-completed only as a tiebreaker
  entries.sort((a, b) => {
    if (a.toPar !== b.toPar) return a.toPar - b.toPar;
    return b.holesCompleted - a.holesCompleted;
  });

  return entries;
}

export function formatToPar(toPar: number): string {
  if (toPar === 0) return "E";
  if (toPar > 0) return `+${toPar}`;
  return `${toPar}`;
}
