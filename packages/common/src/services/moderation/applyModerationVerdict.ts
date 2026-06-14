import type { ModerationFlag } from '@op/db/schema';

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
 *    submitted (forged ref, or a redelivery after the flag was resolved and
 *    its submissions cleared) and nothing was recorded.
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
}

export type ApplyModerationVerdictResult = {
  action: 'created' | 'flagged' | 'dismissed' | 'noop';
  flag?: ModerationFlag;
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

  const aggregate = await deps.recordTaskVerdict({
    itemType,
    itemId,
    roundId: verdict.roundId,
    mediaId: verdict.mediaId,
    verdict: verdict.verdict,
    scores: verdict.scores,
    reason: verdict.reason,
    externalRecordId: verdict.externalRecordId,
  });

  // Unknown task: nothing we submitted is waiting on this verdict — a forged
  // ref, a task from a superseded round, or a redelivery after the flag was
  // resolved and its submissions cleared. Recording nothing, deciding nothing.
  if (!aggregate) {
    return { action: 'noop' };
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
        return { action: 'noop', flag };
      }
      await deps.emitFlagged({ itemType, itemId, moderationFlagId: flag.id });
      return { action: 'created', flag };
    }

    if (existing.status === 'pending') {
      const flag = await deps.markFlagged(existing.id, patch);
      // Lost the compare-and-set: the flag left `pending` between the read and
      // the write (admin resolution or a concurrent webhook). Their decision
      // stands; in particular, don't emit a second notification.
      if (!flag) {
        return { action: 'noop', flag: existing };
      }
      await deps.emitFlagged({ itemType, itemId, moderationFlagId: flag.id });
      return { action: 'flagged', flag };
    }

    // Already flagged (or otherwise resolved): a duplicate/late webhook is a no-op.
    return { action: 'noop', flag: existing };
  }

  // No task is flagged. Once *every* task has come back clear, dismiss the
  // open flag — a pending user report whose first verdict came back clean, or
  // a previously-flagged item the provider has now cleared (an overturn, or a
  // re-reviewed edit; either way the provider's latest review wins). Admin
  // resolutions aren't open and can't be hit here.
  if (aggregate.allResolved && existing) {
    const flag = await deps.markDismissed(existing.id);
    if (!flag) {
      return { action: 'noop', flag: existing };
    }
    return { action: 'dismissed', flag };
  }

  return { action: 'noop', flag: existing };
};
