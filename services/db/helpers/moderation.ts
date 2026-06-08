import { timestamp } from 'drizzle-orm/pg-core';

/**
 * Denormalized moderation-hide flag, mixed into every moderatable entity
 * (proposals, posts, users). Kept deliberately separate from user-controlled
 * `visibility` so the two compose: content is shown only when it is both
 * visible AND not moderation-hidden (`moderationHiddenAt IS NULL`).
 *
 * The full audit trail (reason, scores, external provider link, reviewer) lives
 * in the `moderation_records` table; this column exists purely so list/detail
 * read paths can filter cheaply without joining that table on every query.
 */
export const moderationColumns = {
  // Set when async moderation flags the row; cleared when a flag is dismissed.
  moderationHiddenAt: timestamp('moderation_hidden_at', {
    withTimezone: true,
    mode: 'string',
  }),
} as const;
