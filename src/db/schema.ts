import {
  pgTable,
  text,
  integer,
  serial,
  timestamp,
  date,
  uuid,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";

// ─── Accounts ───────────────────────────────────────────────
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey(), // matches Supabase Auth user ID
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Roster Players (organizer's saved player list) ─────────
export const rosterPlayers = pgTable("roster_players", {
  id: serial("id").primaryKey(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => accounts.id),
  name: text("name").notNull(),
  nickname: text("nickname"),
  email: text("email"),
  handicap: integer("handicap").default(0).notNull(),
  avatarEmoji: text("avatar_emoji").default("🏌️"),
  claimedBy: uuid("claimed_by").references(() => accounts.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Tournaments ────────────────────────────────────────────
export const tournaments = pgTable("tournaments", {
  id: text("id").primaryKey(), // nanoid
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => accounts.id),
  name: text("name").notNull(),
  date: date("date").notNull(),
  buyInCents: integer("buy_in_cents").default(2000).notNull(),
  numHoles: integer("num_holes").default(18).notNull(),
  unclaimedRule: text("unclaimed_rule").default("split_among_winners").notNull(),
  status: text("status").default("setup").notNull(), // setup | active | finalized
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Tournament Players ─────────────────────────────────────
export const tournamentPlayers = pgTable("tournament_players", {
  id: serial("id").primaryKey(),
  tournamentId: text("tournament_id")
    .notNull()
    .references(() => tournaments.id),
  rosterPlayerId: integer("roster_player_id")
    .notNull()
    .references(() => rosterPlayers.id),
  name: text("name").notNull(), // snapshot
  nickname: text("nickname"),
  handicap: integer("handicap").default(0).notNull(),
  avatarEmoji: text("avatar_emoji").default("🏌️"),
});

// ─── Groups ─────────────────────────────────────────────────
export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  tournamentId: text("tournament_id")
    .notNull()
    .references(() => tournaments.id),
  name: text("name").notNull(),
});

// ─── Group Players ──────────────────────────────────────────
export const groupPlayers = pgTable(
  "group_players",
  {
    groupId: integer("group_id")
      .notNull()
      .references(() => groups.id),
    playerId: integer("player_id")
      .notNull()
      .references(() => tournamentPlayers.id),
  },
  (table) => [primaryKey({ columns: [table.groupId, table.playerId] })]
);

// ─── Scores ─────────────────────────────────────────────────
export const scores = pgTable(
  "scores",
  {
    id: serial("id").primaryKey(),
    tournamentId: text("tournament_id")
      .notNull()
      .references(() => tournaments.id),
    playerId: integer("player_id")
      .notNull()
      .references(() => tournamentPlayers.id),
    hole: integer("hole").notNull(),
    strokes: integer("strokes").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("scores_player_hole_idx").on(table.playerId, table.hole)]
);

// ─── Course Holes ───────────────────────────────────────────
export const courseHoles = pgTable(
  "course_holes",
  {
    id: serial("id").primaryKey(),
    tournamentId: text("tournament_id")
      .notNull()
      .references(() => tournaments.id),
    hole: integer("hole").notNull(),
    par: integer("par").default(4).notNull(),
  },
  (table) => [
    uniqueIndex("course_holes_tournament_hole_idx").on(
      table.tournamentId,
      table.hole
    ),
  ]
);

// ─── Presses (side bets) ────────────────────────────────────
export const presses = pgTable("presses", {
  id: serial("id").primaryKey(),
  tournamentId: text("tournament_id")
    .notNull()
    .references(() => tournaments.id),
  groupId: integer("group_id")
    .notNull()
    .references(() => groups.id),
  fromPlayerId: integer("from_player_id")
    .notNull()
    .references(() => tournamentPlayers.id),
  toPlayerId: integer("to_player_id")
    .notNull()
    .references(() => tournamentPlayers.id),
  hole: integer("hole").notNull(),
  multiplier: integer("multiplier").default(2).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Reactions ──────────────────────────────────────────────
export const reactions = pgTable("reactions", {
  id: serial("id").primaryKey(),
  tournamentId: text("tournament_id")
    .notNull()
    .references(() => tournaments.id),
  playerId: integer("player_id")
    .notNull()
    .references(() => tournamentPlayers.id),
  hole: integer("hole").notNull(),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Player Stats (lifetime, cached) ────────────────────────
export const playerStats = pgTable("player_stats", {
  id: serial("id").primaryKey(),
  rosterPlayerId: integer("roster_player_id")
    .notNull()
    .references(() => rosterPlayers.id)
    .unique(),
  totalSkins: integer("total_skins").default(0).notNull(),
  totalWinningsCents: integer("total_winnings_cents").default(0).notNull(),
  totalLossesCents: integer("total_losses_cents").default(0).notNull(),
  roundsPlayed: integer("rounds_played").default(0).notNull(),
  currentStreak: integer("current_streak").default(0).notNull(),
  bestSkinsRound: integer("best_skins_round").default(0).notNull(),
  bestWinningsRound: integer("best_winnings_round").default(0).notNull(),
  powerRank: integer("power_rank"),
  prevPowerRank: integer("prev_power_rank"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Player Titles (earned badges) ──────────────────────────
export const playerTitles = pgTable("player_titles", {
  id: serial("id").primaryKey(),
  rosterPlayerId: integer("roster_player_id")
    .notNull()
    .references(() => rosterPlayers.id),
  title: text("title").notNull(), // skin_collector, push_king, closer, mvp, sandbagger
  earnedAt: timestamp("earned_at").defaultNow().notNull(),
  tournamentId: text("tournament_id").references(() => tournaments.id),
});

// ─── Rivalries (head-to-head, cached) ───────────────────────
export const rivalries = pgTable("rivalries", {
  id: serial("id").primaryKey(),
  playerAId: integer("player_a_id")
    .notNull()
    .references(() => rosterPlayers.id),
  playerBId: integer("player_b_id")
    .notNull()
    .references(() => rosterPlayers.id),
  playerAWins: integer("player_a_wins").default(0).notNull(),
  playerBWins: integer("player_b_wins").default(0).notNull(),
  playerANetCents: integer("player_a_net_cents").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Event RSVPs ────────────────────────────────────────────
export const eventRsvps = pgTable("event_rsvps", {
  id: serial("id").primaryKey(),
  tournamentId: text("tournament_id")
    .notNull()
    .references(() => tournaments.id),
  rosterPlayerId: integer("roster_player_id")
    .notNull()
    .references(() => rosterPlayers.id),
  status: text("status").default("maybe").notNull(), // in | out | maybe
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
