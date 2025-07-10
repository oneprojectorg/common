export const REACTION_TYPES = {
  LIKE: 'like',
  LOVE: 'love',
  LAUGH: 'laugh',
  ANGRY: 'angry',
  SAD: 'sad',
} as const;

export type ReactionType = typeof REACTION_TYPES[keyof typeof REACTION_TYPES];

export const REACTION_OPTIONS = [
  { key: REACTION_TYPES.LIKE, label: 'Like', emoji: '👍' },
  { key: REACTION_TYPES.LOVE, label: 'Love', emoji: '❤️' },
  { key: REACTION_TYPES.LAUGH, label: 'Laugh', emoji: '😂' },
  { key: REACTION_TYPES.ANGRY, label: 'Angry', emoji: '😠' },
  { key: REACTION_TYPES.SAD, label: 'Sad', emoji: '😢' },
] as const;

export const VALID_REACTION_TYPES = Object.values(REACTION_TYPES);