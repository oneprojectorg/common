import {
  getPhaseIndex,
  hasPhaseEnded,
  isPhaseAtOrBefore,
} from '@op/common/client';

/**
 * `past`: every field is locked. `current`: it keeps its place and start date.
 * `free`: nothing is locked.
 */
export type PhaseLockState = 'past' | 'current' | 'free';

export type GetPhaseLock = (phaseId: string) => PhaseLockState;

export interface PastPhaseLock {
  getLock: GetPhaseLock;
  canAddPhases: boolean;
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
    return { getLock: () => 'free', canAddPhases: true };
  }

  const source = { phases };
  // The server refuses every phase write when the current phase is missing.
  if (getPhaseIndex(source, currentStateId) === -1) {
    return { getLock: () => 'past', canAddPhases: false };
  }

  return {
    getLock: (phaseId) => {
      if (hasPhaseEnded(source, phaseId, currentStateId)) {
        return 'past';
      }
      return isPhaseAtOrBefore(source, phaseId, currentStateId)
        ? 'current'
        : 'free';
    },
    canAddPhases: true,
  };
};

/** Locked phases stay a fixed prefix in their saved order; only free phases move. */
export const reorderFreePhases = <Phase extends { id: string }>(
  phases: readonly Phase[],
  reorderedFree: readonly Phase[],
  getLock: GetPhaseLock,
): Phase[] => [
  ...phases.filter((phase) => getLock(phase.id) !== 'free'),
  ...reorderedFree.filter((phase) => getLock(phase.id) === 'free'),
];
