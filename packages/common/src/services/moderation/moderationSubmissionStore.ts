import { type DbClient, and, db, eq, ne, notInArray, or } from '@op/db/client';
import { moderationSubmissions } from '@op/db/schema';

import { decodeContentRef } from './contentRef';
import {
  type SubmissionAggregate,
  type SubmissionTaskState,
  computeSubmissionAggregate,
} from './submissionAggregate';
import type { ModerationItemType, ModerationScores } from './types';

export type { SubmissionAggregate };

/** Sentinel media id for an item's text task (vs. an attachment index). */
export const TEXT_TASK_ID = 'text';

/** Normalizes a decoded content-ref media segment to a submission row's
 *  `mediaId`: the text task carries no segment, so it maps to the sentinel. */
export const toSubmissionMediaId = (mediaId?: string): string =>
  mediaId ?? TEXT_TASK_ID;

/** Maps the content-refs a provider submitted to their submission `mediaId`s. */
export const submissionMediaIdsFromRefs = (refs: string[]): string[] =>
  refs.map((ref) => toSubmissionMediaId(decodeContentRef(ref).mediaId));

// The pg enum column widens to `string` (enumToPgEnum); narrow it back for the
// aggregate computation. An unrecognized value counts as `pending` — the
// conservative reading (keeps the item unresolved rather than clearing it).
const SUBMISSION_VERDICTS: ReadonlySet<string> = new Set([
  'pending',
  'flagged',
  'clear',
] satisfies SubmissionTaskState['verdict'][]);

const isTaskVerdict = (
  value: string,
): value is SubmissionTaskState['verdict'] => SUBMISSION_VERDICTS.has(value);

const toTaskVerdict = (value: string): SubmissionTaskState['verdict'] =>
  isTaskVerdict(value) ? value : 'pending';

/**
 * Records the round of tasks an item is about to be submitted with (one row
 * per task, `pending`, all carrying `roundId`). Written *before* the provider
 * submit, so a verdict can never arrive for a task we haven't recorded.
 *
 * Rows from a different round, and rows for tasks not in this round, are
 * replaced. Rows already present for this same round (an Inngest retry after
 * a partial submit failure — the round id is memoized per event) are kept
 * rather than reset, so a verdict that landed between attempts isn't lost.
 */
export const recordSubmissionRound = async (
  itemType: ModerationItemType,
  itemId: string,
  roundId: string,
  mediaIds: string[],
): Promise<void> => {
  const itemScope = and(
    eq(moderationSubmissions.itemType, itemType),
    eq(moderationSubmissions.itemId, itemId),
  );
  await db.transaction(async (tx) => {
    await tx.delete(moderationSubmissions).where(
      mediaIds.length > 0
        ? and(
            itemScope,
            // Anything not part of this exact round is superseded: rows from
            // an earlier round (even for the same task) and rows for tasks
            // this round no longer has (e.g. a removed attachment).
            or(
              ne(moderationSubmissions.roundId, roundId),
              notInArray(moderationSubmissions.mediaId, mediaIds),
            ),
          )
        : itemScope,
    );
    if (mediaIds.length > 0) {
      await tx
        .insert(moderationSubmissions)
        .values(
          mediaIds.map((mediaId) => ({
            itemType,
            itemId,
            roundId,
            mediaId,
            verdict: 'pending' as const,
          })),
        )
        .onConflictDoNothing();
    }
  });
};

/**
 * Records a single task's verdict and returns the round's aggregate across
 * all its tasks (see {@link computeSubmissionAggregate}).
 *
 * Update-only and round-matched: the verdict must hit a recorded task of the
 * round it was issued for, otherwise `null` is returned and nothing is
 * written — that covers forged refs and verdicts for superseded rounds. (A
 * redelivery after the flag was resolved still matches: resolving a flag
 * leaves the submission rows in place, so the verdict is applied.) The
 * item's rows are locked for the duration so concurrent task verdicts
 * serialize; otherwise two final `clear` verdicts could each see the other
 * still pending and neither would dismiss the flag.
 */
export const recordSubmissionVerdict = async ({
  itemType,
  itemId,
  mediaId,
  roundId,
  verdict,
  scores,
  reason,
  externalRecordId,
}: {
  itemType: ModerationItemType;
  itemId: string;
  mediaId: string;
  roundId: string;
  verdict: 'flagged' | 'clear';
  scores?: ModerationScores;
  reason?: string;
  externalRecordId?: string;
}): Promise<SubmissionAggregate | null> => {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: moderationSubmissions.id,
        roundId: moderationSubmissions.roundId,
        mediaId: moderationSubmissions.mediaId,
        verdict: moderationSubmissions.verdict,
        scores: moderationSubmissions.scores,
        reason: moderationSubmissions.reason,
        externalRecordId: moderationSubmissions.externalRecordId,
      })
      .from(moderationSubmissions)
      .where(
        and(
          eq(moderationSubmissions.itemType, itemType),
          eq(moderationSubmissions.itemId, itemId),
        ),
      )
      .for('update');

    const target = rows.find(
      (row) => row.mediaId === mediaId && row.roundId === roundId,
    );
    if (!target) {
      return null;
    }

    const written = {
      verdict,
      scores: scores ?? null,
      reason: reason ?? null,
      externalRecordId: externalRecordId ?? null,
    };

    await tx
      .update(moderationSubmissions)
      .set(written)
      .where(eq(moderationSubmissions.id, target.id));

    // The aggregate must reflect this write, so the target row is evaluated
    // with the values just written instead of its locked (pre-update) snapshot.
    return computeSubmissionAggregate(
      rows.map((row) =>
        row.id === target.id
          ? written
          : { ...row, verdict: toTaskVerdict(row.verdict) },
      ),
    );
  });
};

/** Clears an item's submission rows. Today the ONLY caller is the rollback of
 *  a failed submit (`submitUserFlag`) — resolving a flag deliberately leaves
 *  the rows in place, so a later decision on the same round still lands. */
export const clearSubmissions = async (
  itemType: ModerationItemType,
  itemId: string,
  executor: DbClient = db,
): Promise<void> => {
  await executor
    .delete(moderationSubmissions)
    .where(
      and(
        eq(moderationSubmissions.itemType, itemType),
        eq(moderationSubmissions.itemId, itemId),
      ),
    );
};
