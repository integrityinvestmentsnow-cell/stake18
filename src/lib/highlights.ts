import type { SkinResult } from "./skins";

export interface Highlight {
  hole: number;
  type: "skin_won" | "push" | "big_carryover" | "streak" | "birdie" | "birdie_streak" | "eagle" | "snowman";
  text: string;
  emoji: string;
}

export function generateHighlights(
  results: SkinResult[],
  playerNames: Record<number, string>,
  coursePars: Record<number, number>,
  scores: { playerId: number; hole: number; strokes: number }[]
): Highlight[] {
  const highlights: Highlight[] = [];
  let skinStreak: { playerId: number; count: number } = { playerId: 0, count: 0 };

  // Track birdie streaks per player across all holes
  const birdieStreaks: Record<number, number> = {};

  // Get all holes in order
  const allHoles = [...new Set(scores.map((s) => s.hole))].sort((a, b) => a - b);

  // Generate birdie/eagle highlights per hole
  for (const hole of allHoles) {
    const par = coursePars[hole] || 4;
    const holeScores = scores.filter((s) => s.hole === hole);

    for (const s of holeScores) {
      const diff = s.strokes - par;
      const name = playerNames[s.playerId] || "Unknown";

      if (diff <= -2) {
        // Eagle or better
        birdieStreaks[s.playerId] = (birdieStreaks[s.playerId] || 0) + 1;
        highlights.push({
          hole,
          type: "eagle",
          text: `Hole ${hole}: ${name} made eagle!`,
          emoji: "🦅",
        });
      } else if (diff === -1) {
        // Birdie
        birdieStreaks[s.playerId] = (birdieStreaks[s.playerId] || 0) + 1;
        const streak = birdieStreaks[s.playerId];

        if (streak >= 3) {
          // Turkey (3+ birdies in a row)
          highlights.push({
            hole,
            type: "birdie_streak",
            text: `Hole ${hole}: ${name} made birdie — that's a TURKEY! ${streak} birdies in a row!`,
            emoji: "🦃",
          });
        } else if (streak === 2) {
          highlights.push({
            hole,
            type: "birdie_streak",
            text: `Hole ${hole}: ${name} made birdie — 2 in a row! One more for a turkey!`,
            emoji: "🔥",
          });
        } else {
          highlights.push({
            hole,
            type: "birdie",
            text: `Hole ${hole}: ${name} made birdie`,
            emoji: "🐦",
          });
        }
      } else {
        // Not a birdie — reset streak
        birdieStreaks[s.playerId] = 0;

        // Snowman (8 on a hole)
        if (s.strokes === 8) {
          highlights.push({
            hole,
            type: "snowman",
            text: `Hole ${hole}: ${name} just made a snowman!`,
            emoji: "⛄",
          });
        }
      }
    }
  }

  // Generate skins-related highlights
  for (const result of results) {
    if (result.winnerId !== null) {
      const name = playerNames[result.winnerId] || "Unknown";
      const playerScore = scores.find(
        (s) => s.playerId === result.winnerId && s.hole === result.hole
      );
      const par = coursePars[result.hole] || 4;
      const diff = playerScore ? playerScore.strokes - par : 0;

      const scoreLabel =
        diff <= -2
          ? "eagled"
          : diff === -1
            ? "birdied"
            : diff === 0
              ? "parred"
              : diff === 1
                ? "bogeyed"
                : `scored ${playerScore?.strokes}`;

      if (result.skinsValue > 1) {
        highlights.push({
          hole: result.hole,
          type: "big_carryover",
          text: `Hole ${result.hole}: ${name} ${scoreLabel} to steal a ${result.skinsValue}-skin carryover!`,
          emoji: "💰",
        });
      } else {
        highlights.push({
          hole: result.hole,
          type: "skin_won",
          text: `Hole ${result.hole}: ${name} ${scoreLabel} to win the skin`,
          emoji: diff <= -1 ? "🔥" : "✅",
        });
      }

      // Track skin streaks
      if (skinStreak.playerId === result.winnerId) {
        skinStreak.count++;
        if (skinStreak.count >= 2) {
          highlights.push({
            hole: result.hole,
            type: "streak",
            text: `${name} is on a ${skinStreak.count}-hole skin streak!`,
            emoji: "🔥",
          });
        }
      } else {
        skinStreak = { playerId: result.winnerId, count: 1 };
      }
    } else if (result.carryover > 0) {
      highlights.push({
        hole: result.hole,
        type: "push",
        text: `Hole ${result.hole}: Push! ${result.carryover + 1} skins now riding on the next hole`,
        emoji: "🤝",
      });
    }
  }

  // Sort: most recent hole first, birdie streaks/eagles at top
  highlights.sort((a, b) => {
    if (b.hole !== a.hole) return b.hole - a.hole;
    // Within same hole, prioritize birdie streaks and eagles
    const priority: Record<string, number> = {
      eagle: 0,
      birdie_streak: 1,
      birdie: 2,
      big_carryover: 3,
      skin_won: 4,
      streak: 5,
      push: 6,
    };
    return (priority[a.type] ?? 9) - (priority[b.type] ?? 9);
  });

  return highlights;
}
