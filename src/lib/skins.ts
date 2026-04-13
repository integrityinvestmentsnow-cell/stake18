export interface PlayerScore {
  playerId: number;
  hole: number;
  strokes: number;
}

export interface SkinResult {
  hole: number;
  winnerId: number | null; // null = push
  skinsValue: number;
  carryover: number;
}

export interface SkinsSummary {
  results: SkinResult[];
  playerSkins: Record<number, number>; // playerId -> total skins won
  totalSkinsAwarded: number;
  unclaimedSkins: number;
}

export type SkinsRule = "carry_over" | "no_carry";

export function computeSkins(
  scores: PlayerScore[],
  playerIds: number[],
  numHoles: number = 18,
  unclaimedRule: "split_among_winners" = "split_among_winners",
  skinsRule: SkinsRule = "carry_over"
): SkinsSummary {
  const results: SkinResult[] = [];
  const playerSkins: Record<number, number> = {};
  playerIds.forEach((id) => (playerSkins[id] = 0));

  let carryover = 0;

  for (let hole = 1; hole <= numHoles; hole++) {
    const skinsAtStake = skinsRule === "carry_over" ? 1 + carryover : 1;
    const holeScores = scores.filter((s) => s.hole === hole);

    // Skip holes where not all players have scored
    if (holeScores.length < playerIds.length) {
      results.push({
        hole,
        winnerId: null,
        skinsValue: 0,
        carryover: skinsRule === "carry_over" ? carryover : 0,
      });
      continue;
    }

    const minStrokes = Math.min(...holeScores.map((s) => s.strokes));
    const playersWithMin = holeScores.filter((s) => s.strokes === minStrokes);

    if (playersWithMin.length === 1) {
      // One winner — they take the skins
      const winnerId = playersWithMin[0].playerId;
      playerSkins[winnerId] += skinsAtStake;
      results.push({
        hole,
        winnerId,
        skinsValue: skinsAtStake,
        carryover: 0,
      });
      carryover = 0;
    } else {
      // Tie — push
      if (skinsRule === "carry_over") {
        results.push({
          hole,
          winnerId: null,
          skinsValue: 0,
          carryover: skinsAtStake,
        });
        carryover = skinsAtStake;
      } else {
        // All tie, all die — skin is lost, no carryover
        results.push({
          hole,
          winnerId: null,
          skinsValue: 0,
          carryover: 0,
        });
      }
    }
  }

  // Handle unclaimed skins after hole 18 (only relevant for carry_over)
  let unclaimedSkins = skinsRule === "carry_over" ? carryover : 0;
  if (unclaimedRule === "split_among_winners" && unclaimedSkins > 0) {
    const winners = Object.entries(playerSkins).filter(([, skins]) => skins > 0);
    if (winners.length > 0) {
      const perPlayer = unclaimedSkins / winners.length;
      winners.forEach(([playerId]) => {
        playerSkins[Number(playerId)] += perPlayer;
      });
      unclaimedSkins = 0;
    }
  }

  const totalSkinsAwarded = Object.values(playerSkins).reduce((a, b) => a + b, 0);

  return {
    results,
    playerSkins,
    totalSkinsAwarded,
    unclaimedSkins,
  };
}

export function computePayouts(
  playerSkins: Record<number, number>,
  totalPotCents: number,
  totalSkinsAwarded: number
): Record<number, number> {
  if (totalSkinsAwarded === 0) return {};

  const valuePerSkin = totalPotCents / totalSkinsAwarded;
  const payouts: Record<number, number> = {};

  for (const [playerId, skins] of Object.entries(playerSkins)) {
    payouts[Number(playerId)] = Math.round(skins * valuePerSkin);
  }

  return payouts;
}
