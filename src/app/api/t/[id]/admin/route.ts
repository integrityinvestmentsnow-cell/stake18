import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAdminForTournament } from "@/lib/auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isOwner = await isAdminForTournament(supabase, id);
  if (!isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { action } = body;

  switch (action) {
    case "add_player": {
      const { rosterPlayerId } = body;
      const { data: roster } = await supabase
        .from("roster_players")
        .select("*")
        .eq("id", rosterPlayerId)
        .single();

      if (!roster) {
        return NextResponse.json(
          { error: "Roster player not found" },
          { status: 404 }
        );
      }

      const { data: player, error } = await supabase
        .from("tournament_players")
        .insert({
          tournament_id: id,
          roster_player_id: roster.id,
          name: roster.name,
          nickname: roster.nickname,
          handicap: roster.handicap,
          avatar_emoji: roster.avatar_emoji,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(player);
    }

    case "edit_player": {
      const { playerId, name, nickname, handicap, avatarEmoji } = body;
      const { error } = await supabase
        .from("tournament_players")
        .update({
          name,
          nickname: nickname || null,
          handicap: handicap ?? 0,
          avatar_emoji: avatarEmoji || "🏌️",
        })
        .eq("id", playerId)
        .eq("tournament_id", id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    case "create_group": {
      const { name, playerIds } = body;
      const { data: group, error } = await supabase
        .from("groups")
        .insert({ tournament_id: id, name })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (playerIds && playerIds.length > 0) {
        await supabase.from("group_players").insert(
          playerIds.map((playerId: number) => ({
            group_id: group.id,
            player_id: playerId,
          }))
        );
      }

      return NextResponse.json(group);
    }

    case "rename_group": {
      const { groupId, name } = body;
      const { error } = await supabase
        .from("groups")
        .update({ name })
        .eq("id", groupId)
        .eq("tournament_id", id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    case "add_player_to_group": {
      const { groupId, playerId } = body;
      const { error } = await supabase
        .from("group_players")
        .insert({ group_id: groupId, player_id: playerId });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    case "remove_player_from_group": {
      const { groupId, playerId } = body;
      await supabase
        .from("group_players")
        .delete()
        .eq("group_id", groupId)
        .eq("player_id", playerId);
      return NextResponse.json({ success: true });
    }

    case "remove_player": {
      // Remove a player from the tournament entirely — for no-shows or
      // last-minute cancellations. Cleans up every place this player is
      // referenced so the leaderboard, skins calc, and pot all recompute as
      // if they were never in the tournament.
      const { playerId } = body;
      if (!playerId) {
        return NextResponse.json({ error: "playerId is required" }, { status: 400 });
      }

      // Verify the player actually belongs to this tournament before we start
      // deleting things.
      const { data: tp } = await supabase
        .from("tournament_players")
        .select("id")
        .eq("id", playerId)
        .eq("tournament_id", id)
        .maybeSingle();
      if (!tp) {
        return NextResponse.json({ error: "Player not found in tournament" }, { status: 404 });
      }

      // Use the service-role client because scores RLS requires it for writes,
      // and several of the other tables had their own RLS quirks that silently
      // blocked anon-session deletes (same root cause as the tournament-delete
      // fix from 05-11).
      const writer = createServiceClient();

      // 1. Delete any scores the player has entered.
      await writer
        .from("scores")
        .delete()
        .eq("tournament_id", id)
        .eq("player_id", playerId);

      // 2. Remove from any skins group they were in (group_players is keyed
      //    by group_id but not by tournament_id; the player_id is globally
      //    unique to this tournament, so this is safe).
      await writer.from("group_players").delete().eq("player_id", playerId);

      // 3. Strip the player from every scorer_groups.player_ids array in this
      //    tournament. We have to fetch + filter + update because the column
      //    is jsonb, not a relational FK.
      const { data: scorerGroups } = await writer
        .from("scorer_groups")
        .select("id, player_ids")
        .eq("tournament_id", id);
      for (const sg of scorerGroups || []) {
        if (Array.isArray(sg.player_ids) && sg.player_ids.includes(playerId)) {
          const filtered = sg.player_ids.filter((p: number) => p !== playerId);
          await writer
            .from("scorer_groups")
            .update({ player_ids: filtered })
            .eq("id", sg.id);
        }
      }

      // 4. Finally delete the tournament_players row.
      const { error: delError } = await writer
        .from("tournament_players")
        .delete()
        .eq("id", playerId);
      if (delError) {
        return NextResponse.json({ error: delError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    case "delete_group": {
      const { groupId } = body;
      // Remove all players from group first
      await supabase
        .from("group_players")
        .delete()
        .eq("group_id", groupId);
      await supabase
        .from("groups")
        .delete()
        .eq("id", groupId)
        .eq("tournament_id", id);
      return NextResponse.json({ success: true });
    }

    case "update_leaderboard_style": {
      const { leaderboardStyle } = body;
      await supabase
        .from("tournaments")
        .update({ leaderboard_style: leaderboardStyle })
        .eq("id", id);
      return NextResponse.json({ success: true });
    }

    case "update_skins_rule": {
      const { skinsRule } = body;
      await supabase
        .from("tournaments")
        .update({ skins_rule: skinsRule })
        .eq("id", id);
      return NextResponse.json({ success: true });
    }

    case "update_birdie_or_better": {
      const { birdieOrBetter } = body;
      await supabase
        .from("tournaments")
        .update({ birdie_or_better: birdieOrBetter === true })
        .eq("id", id);
      return NextResponse.json({ success: true });
    }

    case "update_par": {
      const { hole, par } = body;
      await supabase
        .from("course_holes")
        .update({ par })
        .eq("tournament_id", id)
        .eq("hole", hole);
      return NextResponse.json({ success: true });
    }

    case "start": {
      await supabase
        .from("tournaments")
        .update({ status: "active" })
        .eq("id", id);
      return NextResponse.json({ success: true });
    }

    case "finalize": {
      await supabase
        .from("tournaments")
        .update({ status: "finalized" })
        .eq("id", id);
      return NextResponse.json({ success: true });
    }

    case "reopen": {
      await supabase
        .from("tournaments")
        .update({ status: "active" })
        .eq("id", id);
      return NextResponse.json({ success: true });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
