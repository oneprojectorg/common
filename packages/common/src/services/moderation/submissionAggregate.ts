import type { ModerationScores } from './types';
import { mergeModerationScores } from './utils';

/**
 * Aggregate verdict across all of an item's submitted tasks. `anyPending` is
 * true while we're still waiting on any task; `allResolved` once none are
 * pending. The merged evidence describes the flagged tasks.
 */
export interface SubmissionAggregate {
  anyFlagged: boolean;
  anyPending: boolean;
  allResolved: boolean;
  scores?: ModerationScores;
  reason?: string;
  externalRecordId?: string;
}

/** The slice of a submission row the aggregate computation reads. */
export interface SubmissionTaskState {
  verdict: 'pending' | 'flagged' | 'clear';
  scores?: ModerationScores | null;
  reason?: string | null;
  externalRecordId?: string | null;
}

/** Folds a task's scores into the running aggregate, keeping the worst score
 *  per category. Returns `base` untouched when the task carries no scores, so
 *  the aggregate stays `undefined` until some flagged task supplies evidence. */
export const mergeSubmissionScores = (
  base: ModerationScores | undefined,
  next: ModerationScores | null | undefined,
): ModerationScores | undefined => {
  if (!next) {
    return base;
  }
  return mergeModerationScores(base, next);
};

/**
 * The per-task verdict accounting, as a pure function of the round's task
 * states: flagged-if-any, clear-only-when-all-resolved, with the evidence
 * (scores / reasons / provider record id) merged across the flagged tasks.
 */
export const computeSubmissionAggregate = (
  tasks: SubmissionTaskState[],
): SubmissionAggregate => {
  let anyFlagged = false;
  let anyPending = false;
  let scores: ModerationScores | undefined;
  const reasons: string[] = [];
  let externalRecordId: string | undefined;

  for (const task of tasks) {
    if (task.verdict === 'pending') {
      anyPending = true;
    } else if (task.verdict === 'flagged') {
      anyFlagged = true;
      scores = mergeSubmissionScores(scores, task.scores);
      if (task.reason) {
        reasons.push(task.reason);
      }
      externalRecordId ??= task.externalRecordId ?? undefined;
    }
  }

  return {
    anyFlagged,
    anyPending,
    allResolved: !anyPending,
    scores,
    reason: reasons.length > 0 ? reasons.join('; ') : undefined,
    externalRecordId,
  };
};
