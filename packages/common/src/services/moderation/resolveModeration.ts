import { and, db, eq, inArray } from '@op/db/client';
import {
  type ModerationFlag,
  moderationFlags,
  moderationSubmissions,
} from '@op/db/schema';

import { CommonError } from '../../utils';

export interface ResolveModerationInput {
  flagId: string;
  /** `confirmed` upholds the flag; `dismissed` marks it a false positive. */
  status: 'confirmed' | 'dismissed';
}

/**
 * Admin review outcome for an open flag: mark it confirmed or dismissed and
 * stamp `reviewedAt`. We deliberately don't record *who* reviewed — review can
 * happen on the provider's side, outside our system.
 *
 * Guarded on the flag still being open (`pending`/`flagged`) so a resolved
 * flag can't be re-resolved. The item's submission rows are cleared with it:
 * the admin's decision is terminal for this round, so a redelivered provider
 * webhook for it must find nothing to act on — otherwise it would re-create
 * the flag and re-notify the author, silently undoing the admin's call.
 *
 * Resolving changes the item's visibility (dismissing un-hides it), so any
 * caller must broadcast the invalidation — a tRPC route via
 * `registerMutationChannels(await getModerationItemChannels(...))`, anything
 * else via `realtime.publish` — or other users keep their stale view until a
 * manual reload. (The webhook path already does this in
 * `handleModerationWebhookRequest`.)
 */
export const resolveModeration = async ({
  flagId,
  status,
}: ResolveModerationInput): Promise<ModerationFlag> => {
  return db.transaction(async (tx) => {
    const [flag] = await tx
      .update(moderationFlags)
      .set({ status, reviewedAt: new Date().toISOString() })
      .where(
        and(
          eq(moderationFlags.id, flagId),
          inArray(moderationFlags.status, ['pending', 'flagged']),
        ),
      )
      .returning();

    if (!flag) {
      throw new CommonError('Moderation flag not found or already resolved');
    }

    await tx
      .delete(moderationSubmissions)
      .where(
        and(
          eq(moderationSubmissions.itemType, flag.itemType),
          eq(moderationSubmissions.itemId, flag.itemId),
        ),
      );

    return flag;
  });
};
