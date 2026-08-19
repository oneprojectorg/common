import type { ModerationFlag } from '@op/db/schema';
import { logger } from '@op/logging';

import type { SubmissionAggregate } from './moderationSubmissionStore';
import type {
  ModerationItemType,
  ModerationScores,
  ModerationVerdict,
} from './types';

export interface RecordTaskVerdictInput {
  itemType: ModerationItemType;
  itemId: string;
  /** The submission round the verdict answers; must match the recorded round. */
  roundId: string;
  /** Which task within the item (`undefined` = the text task). */
  mediaId?: string;
  /**
   * The DB submission enum values. `detach` is normalised to `flagged` at the
   * task-record layer (the submission row only knows pending/flagged/clear);
   * the detach signal is preserved on the incoming verdict and drives the
   * detach step separately.
   */
  verdict: 'flagged' | 'clear';
  scores?: ModerationScores;
  reason?: string;
  externalRecordId?: string;
}

export interface CreateAutomatedFlagInput {
  itemType: ModerationItemType;
  itemId: string;
  externalRecordId?: string;
  reason?: string;
  scores?: ModerationScores;
}

export interface FlagVerdictPatch {
  externalRecordId?: string;
  reason?: string;
  scores?: ModerationScores;
}

/**
 * Side-effecting operations the verdict logic needs, injected so the decision
 * flow is unit-testable without a DB.
 *
 *  - `recordTaskVerdict` stores this task's verdict and returns the item's
 *    aggregate across all its tasks (an item fans out into several provider
 *    tasks; see `moderationSubmissionStore`). `null` means the task was never
 *    submitted (a forged ref, or a ref from a round that a later submission
 *    superseded) and nothing was recorded.
 *  - `findOpenFlag` returns the item's open flag (`pending` or `flagged`) if any.
 *  - `markFlagged` is compare-and-set on `pending`, `markDismissed` on the
 *    open statuses (`pending`/`flagged`); they return `undefined` when the
 *    flag already left that state (an admin or a concurrent webhook won the
 *    race) and nothing was written.
 */
export interface ApplyModerationVerdictDeps {
  recordTaskVerdict: (
    input: RecordTaskVerdictInput,
  ) => Promise<SubmissionAggregate | null>;
  findOpenFlag: (
    itemType: ModerationItemType,
    itemId: string,
  ) => Promise<ModerationFlag | undefined>;
  createFlag: (
    input: CreateAutomatedFlagInput,
  ) => Promise<{ flag: ModerationFlag; created: boolean }>;
  markFlagged: (
    flagId: string,
    patch: FlagVerdictPatch,
  ) => Promise<ModerationFlag | undefined>;
  markDismissed: (flagId: string) => Promise<ModerationFlag | undefined>;
  emitFlagged: (input: {
    itemType: ModerationItemType;
    itemId: string;
    moderationFlagId: string;
  }) => Promise<void>;
  /**
   * Fired when the provider returns a `detach` verdict (child exploitation or
   * terrorism by default). Removes the content from the process so admins can
   * no longer see it — today that means setting `moderationDetachedAt` on the
   * proposal (see `detachProposalForModeration`). Item types that have no
   * detach path short-circuit as a no-op; the flag pipeline still runs so the
   * ordinary hide + notify happens.
   */
  detachContent: (input: {
    itemType: ModerationItemType;
    itemId: string;
    reason?: string;
    externalRecordId?: string;
  }) => Promise<void>;
}

export type ApplyModerationVerdictResult = {
  action: 'created' | 'flagged' | 'dismissed' | 'noop';
  flag?: ModerationFlag;
  detached?: boolean;
};

/**
 * Applies a provider's async per-task verdict. It first records the task, then
 * decides on the item's *aggregate* across all its tasks — so the outcome is
 * independent of the order the provider's callbacks arrive in:
 *
 *  - any task flagged + no open flag        → create an automated flag (+ notify)
 *  - any task flagged + open `pending` flag → mark it flagged (+ notify)
 *  - any task flagged + already `flagged`   → no-op (idempotent)
 *  - all tasks resolved + none flagged + an open flag → dismiss it
 *  - otherwise (still pending, or nothing open to clear) → no-op
 *
 * Crucially, a clean *task* never dismisses an item while another task is
 * still pending or flagged. But a genuine all-clear aggregate dismisses any
 * *open* flag, including one the provider previously flagged: an all-clear on
 * a flagged item means the provider re-reviewed and cleared it (a deliberate
 * overturn, or a re-submitted edit that came back clean — editing flagged
 * content always re-triggers review), and the provider's review wins. Local
 * admin resolutions (`confirmed`/`dismissed`) are not open, so they are never
 * overturned.
 */
export const applyModerationVerdict = async (
  verdict: ModerationVerdict,
  deps: ApplyModerationVerdictDeps,
): Promise<ApplyModerationVerdictResult> => {
  const { itemType, itemId } = verdict;

  // `detach` is a `flagged` verdict at the submission-store layer: the DB
  // enum knows only pending/flagged/clear, and the detach discriminator lives
  // on the in-memory verdict so it can drive the extra detach step below.
  const isDetach = verdict.verdict === 'detach';
  const storedVerdict: 'flagged' | 'clear' =
    isDetach || verdict.verdict === 'flagged' ? 'flagged' : 'clear';

  const aggregate = await deps.recordTaskVerdict({
    itemType,
    itemId,
    roundId: verdict.roundId,
    mediaId: verdict.mediaId,
    verdict: storedVerdict,
    scores: verdict.scores,
    reason: verdict.reason,
    externalRecordId: verdict.externalRecordId,
  });

  // Unknown task: nothing we submitted is waiting on this verdict — a forged
  // ref, or a task from a round a later submission superseded. (Resolution does
  // NOT clear submission rows, so a redelivery still matches.) Deciding
  // nothing.
  // The round-match deliberately gates the detach too: honouring a detach on
  // an unmatched ref would let anyone holding the callback URL detach
  // arbitrary content. A superseded round isn't a coverage hole — the
  // superseding round reviews the item's CURRENT content and delivers its own
  // verdict. Still, a dropped detach is worth an ops-visible line: if these
  // ever appear outside an edit race, something upstream is wrong.
  if (!aggregate) {
    if (isDetach) {
      logger.warn(
        `[moderation] detach verdict dropped (round mismatch) for ${itemType}:${itemId} — superseded round or unmatched ref; current round carries its own verdict`,
        { itemType, itemId, roundId: verdict.roundId },
      );
    }
    return { action: 'noop', detached: false };
  }

  // The detach runs on the raw verdict, before the flag decision — it must
  // happen even if a duplicate/late detach verdict lands on an already-flagged
  // item, and it must NOT wait for aggregation across tasks (any detach signal
  // from any task is decisive on its own).
  let detached = false;
  if (isDetach) {
    await deps.detachContent({
      itemType,
      itemId,
      reason: verdict.reason,
      externalRecordId: verdict.externalRecordId,
    });
    detached = true;
  }

  const existing = await deps.findOpenFlag(itemType, itemId);

  if (aggregate.anyFlagged) {
    const patch: FlagVerdictPatch = {
      externalRecordId: aggregate.externalRecordId,
      reason: aggregate.reason,
      scores: aggregate.scores,
    };

    if (!existing) {
      const { flag, created } = await deps.createFlag({
        itemType,
        itemId,
        ...patch,
      });
      // Lost the insert race: a concurrent webhook created the flag and sent
      // the notification — don't notify a second time.
      if (!created) {
        return { action: 'noop', flag, detached };
      }
      await deps.emitFlagged({ itemType, itemId, moderationFlagId: flag.id });
      return { action: 'created', flag, detached };
    }

    if (existing.status === 'pending') {
      const flag = await deps.markFlagged(existing.id, patch);
      // Lost the compare-and-set: the flag left `pending` between the read and
      // the write (admin resolution or a concurrent webhook). Their decision
      // stands; in particular, don't emit a second notification.
      if (!flag) {
        return { action: 'noop', flag: existing, detached };
      }
      await deps.emitFlagged({ itemType, itemId, moderationFlagId: flag.id });
      return { action: 'flagged', flag, detached };
    }

    // Already flagged (or otherwise resolved): a duplicate/late webhook is a no-op.
    return { action: 'noop', flag: existing, detached };
  }

  // No task is flagged. Once *every* task has come back clear, dismiss the
  // open flag — a pending user report whose first verdict came back clean, or
  // a previously-flagged item the provider has now cleared (an overturn, or a
  // re-reviewed edit; either way the provider's latest review wins). Admin
  // resolutions aren't open and can't be hit here.
  if (aggregate.allResolved && existing) {
    const flag = await deps.markDismissed(existing.id);
    if (!flag) {
      return { action: 'noop', flag: existing, detached };
    }
    return { action: 'dismissed', flag, detached };
  }

  return { action: 'noop', flag: existing, detached };
};
