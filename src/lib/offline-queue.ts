// Offline score queue — saves scores to localStorage when network fails,
// then syncs them when connection returns.

interface QueuedScore {
  tournamentId: string;
  playerId: number;
  hole: number;
  strokes: number;
  queuedAt: number;
}

const QUEUE_KEY = "stake18-offline-queue";

function getQueue(): QueuedScore[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedScore[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function queueScore(score: QueuedScore) {
  const queue = getQueue();
  // Replace any existing entry for the same player+hole
  const filtered = queue.filter(
    (s) =>
      !(
        s.tournamentId === score.tournamentId &&
        s.playerId === score.playerId &&
        s.hole === score.hole
      )
  );
  filtered.push(score);
  saveQueue(filtered);
}

export function getQueuedCount(): number {
  return getQueue().length;
}

export function getQueuedScoresForTournament(
  tournamentId: string
): QueuedScore[] {
  return getQueue().filter((s) => s.tournamentId === tournamentId);
}

export async function flushQueue(): Promise<{
  synced: number;
  failed: number;
}> {
  const queue = getQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  const stillFailed: QueuedScore[] = [];

  for (const score of queue) {
    try {
      const res = await fetch(`/api/t/${score.tournamentId}/scores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: score.playerId,
          hole: score.hole,
          strokes: score.strokes,
        }),
      });
      if (res.ok) {
        synced++;
      } else {
        stillFailed.push(score);
      }
    } catch {
      stillFailed.push(score);
    }
  }

  saveQueue(stillFailed);
  return { synced, failed: stillFailed.length };
}

// Auto-sync when coming back online
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    flushQueue();
  });
}
