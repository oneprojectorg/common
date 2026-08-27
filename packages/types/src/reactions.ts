export const REACTION_TYPES = {
  LIKE: 'like',
  DISLIKE: 'dislike',
  LOVE: 'love',
  LAUGH: 'laugh',
  FOLDED_HANDS: 'folded_hands',
  SAD: 'sad',
  CELEBRATE: 'celebrate',
  FIRE: 'fire',
} as const;

export type ReactionType = (typeof REACTION_TYPES)[keyof typeof REACTION_TYPES];

/**
 * The only reaction type written from now on. Posts and comments used to carry
 * a whole emoji palette; they now carry a single like, and 👍 is the palette
 * entry that already meant exactly that. Older rows of the other types are left
 * in place — nothing migrates them — and still count via LIKE_REACTION_TYPES.
 */
export const LIKE_REACTION_TYPE = REACTION_TYPES.LIKE;

/**
 * Historical reaction types that count as one like each.
 *
 * DISLIKE and SAD are deliberately absent: the call was that every *positive*
 * reaction (🔥 🙏 😂 🎉 ❤️ 👍) becomes a like, so a thumbs-down is dropped from
 * the count rather than silently flipped into an endorsement.
 */
export const LIKE_REACTION_TYPES: readonly string[] = [
  REACTION_TYPES.LIKE,
  REACTION_TYPES.LOVE,
  REACTION_TYPES.LAUGH,
  REACTION_TYPES.FOLDED_HANDS,
  REACTION_TYPES.CELEBRATE,
  REACTION_TYPES.FIRE,
];

/**
 * Emoji for each historical reaction type. Only the notification email still
 * reads this, to render reactions recorded before the like/comment buttons.
 */
export const REACTION_OPTIONS = [
  { key: REACTION_TYPES.LIKE, label: 'Like', emoji: '👍' },
  { key: REACTION_TYPES.DISLIKE, label: 'Dislike', emoji: '👎' },
  { key: REACTION_TYPES.LOVE, label: 'Love', emoji: '❤️' },
  { key: REACTION_TYPES.LAUGH, label: 'Laugh', emoji: '😂' },
  { key: REACTION_TYPES.FOLDED_HANDS, label: 'Folded Hands', emoji: '🙏' },
  { key: REACTION_TYPES.CELEBRATE, label: 'Celebrate', emoji: '🎉' },
  { key: REACTION_TYPES.FIRE, label: 'Fire', emoji: '🔥' },
] as const;
