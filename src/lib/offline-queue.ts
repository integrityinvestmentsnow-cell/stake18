// Offline score queue — saves scores to localStorage when network fails,
// then syncs them when connection returns.

interface QueuedScore {
  tournamentId: string;
  playerId: number;
  hole: number;
  strokes: number;
  scorerId: string | null;
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
  rejectedReason?: string;
}> {
  const queue = getQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  const stillFailed: QueuedScore[] = [];
  let rejectedReason: string | undefined;

  for (const score of queue) {
    let res: Response | null = null;
    try {
      res = await fetch(`/api/t/${score.tournamentId}/scores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: score.playerId,
          hole: score.hole,
          strokes: score.strokes,
          scorerId: score.scorerId,
        }),
      });
    } catch {
      // True network error — keep in queue, will retry on next flush
      stillFailed.push(score);
      continue;
    }

    if (res.ok) {
      synced++;
      continue;
    }

    // Score kept in the queue so the user can retry after the underlying
    // issue clears (typically an admin reopening a finalized tournament).
    stillFailed.push(score);

    // Capture the first 403 rationale so the caller can surface it to
    // the user — otherwise sync-now looks like it silently did nothing.
    if (res.status === 403 && !rejectedReason) {
      try {
        const body = await res.json();
        if (body?.error) rejectedReason = body.error as string;
      } catch {}
    }
  }

  saveQueue(stillFailed);
  return { synced, failed: stillFailed.length, rejectedReason };
}

// Auto-sync when coming back online
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    flushQueue();
  });
}
