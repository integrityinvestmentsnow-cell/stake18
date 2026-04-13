import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeSkins, type SkinsRule } from "@/lib/skins";
import { generateHighlights } from "@/lib/highlights";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", id)
    .single();

  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }

  const { data: allScores } = await supabase
    .from("scores")
    .select("*")
    .eq("tournament_id", id);

  const { data: allPlayers } = await supabase
    .from("tournament_players")
    .select("*")
    .eq("tournament_id", id);

  const { data: holes } = await supabase
    .from("course_holes")
    .select("*")
    .eq("tournament_id", id);

  const coursePars: Record<number, number> = {};
  (holes || []).forEach((h) => (coursePars[h.hole] = h.par));

  const { data: allReactions } = await supabase
    .from("reactions")
    .select("*")
    .eq("tournament_id", id);

  const allHighlights = [];

  // Skins is always all players together
  {
    const playerIds = (allPlayers || []).map((p) => p.id);

    const playerNames: Record<number, string> = {};
    (allPlayers || []).forEach((p) => {
      playerNames[p.id] = p.nickname || p.name;
    });

    const allScoresMapped = (allScores || [])
      .map((s) => ({
        playerId: s.player_id,
        hole: s.hole,
        strokes: s.strokes,
      }));

    const skinsSummary = computeSkins(
      allScoresMapped,
      playerIds,
      tournament.num_holes,
      "split_among_winners",
      (tournament.skins_rule || "carry_over") as SkinsRule
    );
    const highlights = generateHighlights(
      skinsSummary.results,
      playerNames,
      coursePars,
      allScoresMapped
    );

    allHighlights.push(
      ...highlights.map((h) => ({
        ...h,
        groupId: -1,
        groupName: "All Players",
      }))
    );
  }

  // Sort by hole descending (most recent first)
  allHighlights.sort((a, b) => b.hole - a.hole);

  // Detect hot seat — all players in one skins game
  const skinCounts: Record<string, number> = {};
  {
    const allPlayerIds = (allPlayers || []).map((p) => p.id);
    const allScoresMapped2 = (allScores || []).map((s) => ({
      playerId: s.player_id, hole: s.hole, strokes: s.strokes,
    }));
    const skinsSummary = computeSkins(
      allScoresMapped2, allPlayerIds, tournament.num_holes,
      "split_among_winners", (tournament.skins_rule || "carry_over") as SkinsRule
    );
    for (const [playerId, skins] of Object.entries(skinsSummary.playerSkins)) {
      const player = (allPlayers || []).find((p) => p.id === Number(playerId));
      if (player && skins > 0) {
        skinCounts[player.nickname || player.name] = skins;
      }
    }
  }

  const hotSeat = Object.entries(skinCounts).sort((a, b) => b[1] - a[1])[0];

  // Generate post-round awards
  const awards: { title: string; emoji: string; player: string; detail: string }[] = [];

  if (tournament.status === "finalized" || (allScores || []).length > 0) {
    const playerData: Record<number, {
      name: string;
      handicap: number;
      scores: { hole: number; strokes: number }[];
      skins: number;
    }> = {};

    for (const p of allPlayers || []) {
      const pScores = (allScores || [])
        .filter((s) => s.player_id === p.id)
        .map((s) => ({ hole: s.hole, strokes: s.strokes }));
      playerData[p.id] = {
        name: p.nickname || p.name,
        handicap: p.handicap || 0,
        scores: pScores,
        skins: 0,
      };
    }

    // Accumulate skins across all groups
    for (const [name, count] of Object.entries(skinCounts)) {
      const player = Object.values(playerData).find((p) => p.name === name);
      if (player) player.skins = count;
    }

    const playersWithScores = Object.values(playerData).filter((p) => p.scores.length > 0);
    const numHoles = tournament.num_holes || 18;

    // Awards only show when every active player (has at least 1 score) has completed all holes
    const allActiveComplete = playersWithScores.length > 0 &&
      playersWithScores.every((p) => p.scores.length >= numHoles);
    const showAwards = allActiveComplete || tournament.status === "finalized";

    if (showAwards && playersWithScores.length > 0) {
      const fullRoundPlayers = playersWithScores.filter((p) => p.scores.length >= numHoles);

      if (fullRoundPlayers.length > 0) {
        // Low Gross — lowest total strokes
        const lowGross = [...fullRoundPlayers].sort(
          (a, b) => a.scores.reduce((s, sc) => s + sc.strokes, 0) - b.scores.reduce((s, sc) => s + sc.strokes, 0)
        )[0];
        const grossTotal = lowGross.scores.reduce((s, sc) => s + sc.strokes, 0);
        awards.push({
          title: "Low Gross",
          emoji: "🏆",
          player: lowGross.name,
          detail: `${grossTotal} (thru ${lowGross.scores.length})`,
        });

        // Low Net — lowest net score (gross - handicap prorated)
        const totalCourseHoles = (holes || []).length || 18;
        const hasHoleHcps = (holes || []).some((h: { hcp?: number }) => h.hcp);

        const netScores = fullRoundPlayers.map((p) => {
          const gross = p.scores.reduce((s, sc) => s + sc.strokes, 0);
          let hcpStrokes: number;

          if (hasHoleHcps && p.handicap > 0) {
            hcpStrokes = p.scores.reduce((strokes, s) => {
              const holeHcp = (holes || []).find((h) => h.hole === s.hole)?.hcp;
              if (holeHcp && p.handicap >= holeHcp) {
                return strokes + (p.handicap >= holeHcp + 18 ? 2 : 1);
              }
              return strokes;
            }, 0);
          } else {
            hcpStrokes = Math.round((p.handicap * p.scores.length) / totalCourseHoles);
          }

          return { name: p.name, net: gross - hcpStrokes, handicap: p.handicap };
        }).sort((a, b) => a.net - b.net);

        if (netScores.length > 0 && netScores.some((n) => n.handicap > 0)) {
          awards.push({
            title: "Low Net",
            emoji: "🥇",
            player: netScores[0].name,
            detail: `net ${netScores[0].net} (hcp ${netScores[0].handicap})`,
          });
        }
      }

      // Skin King — most skins
      const skinKing = [...playersWithScores].sort((a, b) => b.skins - a.skins)[0];
      if (skinKing && skinKing.skins > 0) {
        awards.push({
          title: "Skin King",
          emoji: "👑",
          player: skinKing.name,
          detail: `${skinKing.skins} skins`,
        });
      }

      // Snowman Award — worst single hole
      let worstHole = { name: "", strokes: 0, hole: 0 };
      for (const p of playersWithScores) {
        for (const s of p.scores) {
          if (s.strokes > worstHole.strokes) {
            worstHole = { name: p.name, strokes: s.strokes, hole: s.hole };
          }
        }
      }
      if (worstHole.strokes >= 7) {
        awards.push({
          title: "Snowman Award",
          emoji: "⛄",
          player: worstHole.name,
          detail: `${worstHole.strokes} on hole ${worstHole.hole}`,
        });
      }

      // Mr. Consistent — lowest score variance
      const variances = playersWithScores
        .filter((p) => p.scores.length >= 9)
        .map((p) => {
          const avg = p.scores.reduce((s, sc) => s + sc.strokes, 0) / p.scores.length;
          const variance = p.scores.reduce((s, sc) => s + Math.pow(sc.strokes - avg, 2), 0) / p.scores.length;
          return { name: p.name, variance };
        })
        .sort((a, b) => a.variance - b.variance);
      if (variances.length > 0) {
        awards.push({
          title: "Mr. Consistent",
          emoji: "🎯",
          player: variances[0].name,
          detail: "lowest score variance",
        });
      }

      // Turkey Dinner — most consecutive birdies
      let bestTurkey = { name: "", streak: 0 };
      for (const p of playersWithScores) {
        let streak = 0;
        const sorted = [...p.scores].sort((a, b) => a.hole - b.hole);
        for (const s of sorted) {
          const par = coursePars[s.hole] || 4;
          if (s.strokes < par) {
            streak++;
            if (streak > bestTurkey.streak) {
              bestTurkey = { name: p.name, streak };
            }
          } else {
            streak = 0;
          }
        }
      }
      if (bestTurkey.streak >= 3) {
        awards.push({
          title: "Turkey Dinner",
          emoji: "🦃",
          player: bestTurkey.name,
          detail: `${bestTurkey.streak} birdies in a row`,
        });
      }

      // Ice Cold — birdie right after a double bogey or worse
      for (const p of playersWithScores) {
        const sorted = [...p.scores].sort((a, b) => a.hole - b.hole);
        for (let i = 1; i < sorted.length; i++) {
          const prevPar = coursePars[sorted[i - 1].hole] || 4;
          const currPar = coursePars[sorted[i].hole] || 4;
          if (sorted[i - 1].strokes >= prevPar + 2 && sorted[i].strokes < currPar) {
            awards.push({
              title: "Ice Cold",
              emoji: "🧊",
              player: p.name,
              detail: `birdie after a ${sorted[i - 1].strokes} on hole ${sorted[i - 1].hole}`,
            });
            break;
          }
        }
      }

      // Closer — won the skin on hole 18
      {
        const allPlayerIds = (allPlayers || []).map((p) => p.id);
        const closerScores = (allScores || []).map((s) => ({
          playerId: s.player_id, hole: s.hole, strokes: s.strokes,
        }));
        const closerSkins = computeSkins(closerScores, allPlayerIds, tournament.num_holes, "split_among_winners", (tournament.skins_rule || "carry_over") as SkinsRule);
        const hole18 = closerSkins.results.find((r) => r.hole === 18);
        if (hole18?.winnerId) {
          const player = (allPlayers || []).find((p) => p.id === hole18.winnerId);
          if (player) {
            awards.push({
              title: "Closer",
              emoji: "🔒",
              player: player.nickname || player.name,
              detail: `won the skin on 18${hole18.skinsValue > 1 ? ` (${hole18.skinsValue} skins!)` : ""}`,
            });
          }
        }
      }
    }
  }

  return NextResponse.json({
    highlights: allHighlights,
    reactions: allReactions,
    hotSeat: hotSeat ? { name: hotSeat[0], skins: hotSeat[1] } : null,
    awards,
    status: tournament.status,
  });
}
