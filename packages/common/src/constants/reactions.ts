import { ALLOWED_EMOJIS } from '@op/types';

export type AllowedEmoji = (typeof ALLOWED_EMOJIS)[number];

export function isValidEmoji(emoji: string): emoji is AllowedEmoji {
  return ALLOWED_EMOJIS.includes(emoji as AllowedEmoji);
}
