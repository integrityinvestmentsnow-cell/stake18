export type TournamentStatus = "setup" | "active" | "finalized";

export type UnclaimedRule = "split_among_winners";

export type RsvpStatus = "in" | "out" | "maybe";

export type TitleType =
  | "skin_collector"
  | "push_king"
  | "closer"
  | "mvp"
  | "sandbagger";

export const TITLE_DISPLAY: Record<TitleType, { label: string; emoji: string }> = {
  skin_collector: { label: "Skin Collector", emoji: "🏆" },
  push_king: { label: "Push King", emoji: "👑" },
  closer: { label: "Closer", emoji: "🎯" },
  mvp: { label: "MVP", emoji: "⭐" },
  sandbagger: { label: "Sandbagger", emoji: "🎒" },
};

export const REACTION_EMOJIS = ["🔥", "😂", "💀", "🤡", "💰", "👏"] as const;

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

export function formatCentsDecimal(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
