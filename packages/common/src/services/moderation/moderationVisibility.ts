import { and, db, eq, inArray, notExists } from '@op/db/client';
import { moderationFlags } from '@op/db/schema';
import type { Column, SQL } from 'drizzle-orm';

import type { ModerationItemType } from './types';

/**
 * Flag statuses that hide an item from general reads: the provider deemed it
 * disallowed (`flagged`) or an admin upheld that (`confirmed`). A `pending`
 * user report doesn't hide anything (the verdict isn't in), and
 * `dismissed`/`disputed` flags are resolved in the item's favor.
 */
export const HIDING_MODERATION_STATUSES = ['flagged', 'confirmed'] as const;

/**
 * SQL condition: the row has no active (hiding) moderation flag. Embeds a
 * correlated `NOT EXISTS` against `moderation_flags`, so list reads filter in
 * the database and pagination stays correct. Pass the *aliased* id column of
 * the query being built (e.g. the `table.id` from a relational `RAW`
 * callback) so the subquery correlates against the right alias.
 *
 * Callers compose the owner/admin exceptions around this:
 * `or(noActiveModerationFlag(...), isOwnerCondition)` — and skip the filter
 * entirely for admins.
 */
export const noActiveModerationFlag = (
  itemType: ModerationItemType,
  itemIdColumn: Column | SQL,
): SQL =>
  notExists(
    db
      .select({ id: moderationFlags.id })
      .from(moderationFlags)
      .where(
        and(
          eq(moderationFlags.itemType, itemType),
          eq(moderationFlags.itemId, itemIdColumn),
          inArray(moderationFlags.status, [...HIDING_MODERATION_STATUSES]),
        ),
      ),
  );

/**
 * The subset of `itemIds` that currently carry an active (hiding) flag — one
 * batched query, used to decorate already-authorized list results (owner /
 * admin views) with their `isFlagged` indicator.
 */
export const getActivelyFlaggedItemIds = async (
  itemType: ModerationItemType,
  itemIds: string[],
): Promise<Set<string>> => {
  if (itemIds.length === 0) {
    return new Set();
  }
  const rows = await db
    .select({ itemId: moderationFlags.itemId })
    .from(moderationFlags)
    .where(
      and(
        eq(moderationFlags.itemType, itemType),
        inArray(moderationFlags.itemId, itemIds),
        inArray(moderationFlags.status, [...HIDING_MODERATION_STATUSES]),
      ),
    );
  return new Set(rows.map((row) => row.itemId));
};

/** Whether a single item currently carries an active (hiding) flag. */
export const hasActiveModerationFlag = async (
  itemType: ModerationItemType,
  itemId: string,
): Promise<boolean> => {
  const flagged = await getActivelyFlaggedItemIds(itemType, [itemId]);
  return flagged.has(itemId);
};
