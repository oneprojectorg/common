export const REACTION_TYPES = {
  LIKE: 'like',
  LOVE: 'love',
  LAUGH: 'laugh',
  FOLDED_HANDS: 'folded_hands',
  SAD: 'sad',
  CELEBRATE: 'celebrate',
  FIRE: 'fire',
} as const;

export type ReactionType = (typeof REACTION_TYPES)[keyof typeof REACTION_TYPES];

export const REACTION_OPTIONS = [
  { key: REACTION_TYPES.LIKE, label: 'Like', emoji: '👍' },
  { key: REACTION_TYPES.LIKE, label: 'Dislike', emoji: '👎' },
  { key: REACTION_TYPES.LOVE, label: 'Love', emoji: '❤️' },
  { key: REACTION_TYPES.LAUGH, label: 'Laugh', emoji: '😂' },
  { key: REACTION_TYPES.FOLDED_HANDS, label: 'Folded Hands', emoji: '🙏' },
  { key: REACTION_TYPES.CELEBRATE, label: 'Celebrate', emoji: '🎉' },
  { key: REACTION_TYPES.FIRE, label: 'Fire', emoji: '🔥' },
] as const;

export const VALID_REACTION_TYPES = Object.values(REACTION_TYPES);

// Service layer emoji validation
export const ALLOWED_EMOJIS = [
  '👍',
  '👎',
  '❤️',
  '😂',
  '🙏',
  '🎉',
  '🔥',
] as const;
