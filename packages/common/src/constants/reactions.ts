export const REACTION_TYPES = {
  LIKE: 'like',
  LOVE: 'love',
  LAUGH: 'laugh',
  FOLDED_HANDS: 'folded_hands',
  SAD: 'sad',
} as const;

export type ReactionType = (typeof REACTION_TYPES)[keyof typeof REACTION_TYPES];

export const REACTION_OPTIONS = [
  { key: REACTION_TYPES.LIKE, label: 'Like', emoji: '👍' },
  { key: REACTION_TYPES.LIKE, label: 'Dislike', emoji: '👎' },
  { key: REACTION_TYPES.LOVE, label: 'Love', emoji: '❤️' },
  { key: REACTION_TYPES.LAUGH, label: 'Laugh', emoji: '😂' },
  { key: REACTION_TYPES.FOLDED_HANDS, label: 'Folded Hands', emoji: '🙏' },
] as const;

export const VALID_REACTION_TYPES = Object.values(REACTION_TYPES);
