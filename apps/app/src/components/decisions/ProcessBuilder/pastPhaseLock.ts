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
}): GetPhaseLock => {
  if (isDraft || !currentStateId) {
    return () => 'free';
  }

  const source = { phases };
  // The server refuses every phase write when the current phase is missing.
  if (getPhaseIndex(source, currentStateId) === -1) {
    return () => 'past';
  }

  return (phaseId) => {
    if (hasPhaseEnded(source, phaseId, currentStateId)) {
      return 'past';
    }
    return isPhaseAtOrBefore(source, phaseId, currentStateId)
      ? 'current'
      : 'free';
  };
};
