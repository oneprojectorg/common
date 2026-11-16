import {
  getPhaseIndex,
  hasPhaseEnded,
  isPhaseAtOrBefore,
} from '@op/common/client';

export interface PastPhaseLock {
  /** True when the decision is past draft and its history is locked. */
  isLocked: boolean;
  currentPhaseId: string | null;
  /** A past phase: every field is locked. */
  isPastPhase: (phaseId: string) => boolean;
  /** A past or current phase: it cannot be deleted or reordered. */
  isPhaseLocked: (phaseId: string) => boolean;
}

/**
 * Mirrors the server's `assertPastPhasesUnchanged`: on a decision past draft,
 * the phases before the current one are fixed, and the current phase keeps its
 * place and start date. `phases` is the saved order the server judges against.
 */
export const getPastPhaseLock = ({
  isDraft,
  currentStateId,
  phases,
}: {
  isDraft: boolean;
  currentStateId: string | null | undefined;
  phases: readonly { phaseId: string }[] | undefined;
}): PastPhaseLock => {
  if (isDraft || !currentStateId) {
    return {
      isLocked: false,
      currentPhaseId: currentStateId ?? null,
      isPastPhase: () => false,
      isPhaseLocked: () => false,
    };
  }

  const source = { phases };
  // The server refuses every phase write when the current phase is missing.
  const isCurrentMissing = getPhaseIndex(source, currentStateId) === -1;

  return {
    isLocked: true,
    currentPhaseId: currentStateId,
    isPastPhase: (phaseId) =>
      isCurrentMissing || hasPhaseEnded(source, phaseId, currentStateId),
    isPhaseLocked: (phaseId) =>
      isCurrentMissing || isPhaseAtOrBefore(source, phaseId, currentStateId),
  };
};
