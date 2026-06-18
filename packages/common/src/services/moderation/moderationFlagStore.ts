import { type DbClient, and, db, eq, inArray } from '@op/db/client';
import { type ModerationFlag, moderationFlags } from '@op/db/schema';

import { CommonError } from '../../utils';
import type {
  CreateAutomatedFlagInput,
  FlagVerdictPatch,
} from './applyModerationVerdict';
import type { ModerationItemType } from './types';

// Open = there's a live review for the item: awaiting the provider verdict, or
// already flagged. confirmed/dismissed/disputed are terminal-ish and not "open".
const OPEN_STATUSES = ['pending', 'flagged'] as const;

const now = () => new Date().toISOString();

/** The item's open flag (pending or flagged), if any. */
export const findOpenModerationFlag = async (
  itemType: ModerationItemType,
  itemId: string,
): Promise<ModerationFlag | undefined> => {
  const [flag] = await db
    .select()
    .from(moderationFlags)
    .where(
      and(
        eq(moderationFlags.itemType, itemType),
        eq(moderationFlags.itemId, itemId),
        inArray(moderationFlags.status, [...OPEN_STATUSES]),
      ),
    )
    .limit(1);
  return flag;
};

/** Inserts an automated `flagged` record (provider-initiated, no reporter).
 *  Race-safe: the partial unique index allows only one open flag per item, so a
 *  concurrent insert is swallowed by `ON CONFLICT DO NOTHING` and we return the
 *  existing open flag instead of throwing a unique-violation. `created` tells
 *  the caller whether this call actually inserted — the race loser must not
 *  re-emit the flagged notification the winner already sent. */
export const createAutomatedFlag = async ({
  itemType,
  itemId,
  externalRecordId,
  reason,
  scores,
}: CreateAutomatedFlagInput): Promise<{
  flag: ModerationFlag;
  created: boolean;
}> => {
  const [inserted] = await db
    .insert(moderationFlags)
    .values({
      itemType,
      itemId,
      status: 'flagged',
      source: 'automated',
      scores: scores ?? null,
      reason: reason ?? null,
      externalRecordId: externalRecordId ?? null,
    })
    .onConflictDoNothing()
    .returning();
  if (inserted) {
    return { flag: inserted, created: true };
  }
  // Lost the race: another insert created the open flag first. Return it.
  const existing = await findOpenModerationFlag(itemType, itemId);
  if (!existing) {
    throw new CommonError('Failed to create moderation flag');
  }
  return { flag: existing, created: false };
};

/** Inserts a `pending` record for a user report, awaiting the async verdict.
 *  Race-safe in the same way as {@link createAutomatedFlag}: a concurrent open
 *  flag wins and is returned with `created: false` rather than surfacing a
 *  unique-violation — the loser must not submit a second provider round or
 *  roll back a flag it doesn't own. */
export const createPendingFlag = async ({
  itemType,
  itemId,
  flaggedByProfileId,
  reason,
}: {
  itemType: ModerationItemType;
  itemId: string;
  flaggedByProfileId: string | null;
  reason?: string;
}): Promise<{ flag: ModerationFlag; created: boolean }> => {
  const [inserted] = await db
    .insert(moderationFlags)
    .values({
      itemType,
      itemId,
      status: 'pending',
      source: 'manual',
      reason: reason ?? null,
      flaggedByProfileId,
    })
    .onConflictDoNothing()
    .returning();
  if (inserted) {
    return { flag: inserted, created: true };
  }
  const existing = await findOpenModerationFlag(itemType, itemId);
  if (!existing) {
    throw new CommonError('Failed to create moderation flag');
  }
  return { flag: existing, created: false };
};

/** Deletes a still-`pending` flag — the undo for a user report whose provider
 *  submit failed. Without it the flag would sit pending forever (no submission
 *  round exists to resolve it) and the open-flag idempotency check would
 *  swallow every retry. A flag that has already moved past `pending` is left
 *  untouched. */
export const deletePendingFlag = async (
  flagId: string,
  executor: DbClient = db,
): Promise<void> => {
  await executor
    .delete(moderationFlags)
    .where(
      and(
        eq(moderationFlags.id, flagId),
        eq(moderationFlags.status, 'pending'),
      ),
    );
};

/** Resolves a pending flag to `flagged` once the provider confirms it. Only
 *  overwrites evidence fields the patch actually carries, so a later webhook
 *  (e.g. a second task for the same item) that omits scores/reason can't null
 *  out evidence captured by an earlier one.
 *
 *  Compare-and-set on `status = 'pending'`: a webhook racing an admin
 *  resolution (or a concurrent webhook that already transitioned the flag)
 *  matches zero rows and gets `undefined` back — the caller treats that as a
 *  no-op rather than overwriting the earlier decision. */
export const markFlagFlagged = async (
  flagId: string,
  patch: FlagVerdictPatch,
): Promise<ModerationFlag | undefined> => {
  const [updated] = await db
    .update(moderationFlags)
    .set({
      status: 'flagged',
      reviewedAt: now(),
      ...(patch.externalRecordId !== undefined
        ? { externalRecordId: patch.externalRecordId }
        : {}),
      ...(patch.reason !== undefined ? { reason: patch.reason } : {}),
      ...(patch.scores !== undefined ? { scores: patch.scores } : {}),
    })
    .where(
      and(
        eq(moderationFlags.id, flagId),
        eq(moderationFlags.status, 'pending'),
      ),
    )
    .returning();
  return updated;
};

/** Dismisses an *open* flag (`pending` or `flagged`) when the provider clears
 *  it — covers both a user report coming back clean and the provider
 *  overturning its own earlier flagged verdict. Compare-and-set like
 *  {@link markFlagFlagged}: terminal statuses (`confirmed`/`dismissed`) never
 *  match, so a local admin resolution is never overwritten; `undefined` means
 *  the flag was no longer open and nothing was written. */
export const markFlagDismissed = async (
  flagId: string,
): Promise<ModerationFlag | undefined> => {
  const [updated] = await db
    .update(moderationFlags)
    .set({ status: 'dismissed', reviewedAt: now() })
    .where(
      and(
        eq(moderationFlags.id, flagId),
        inArray(moderationFlags.status, [...OPEN_STATUSES]),
      ),
    )
    .returning();
  return updated;
};
