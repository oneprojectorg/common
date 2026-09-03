import type { PhaseInstanceData } from '../schemas/instanceData';

/**
 * Whether a proposal can still be reached at all. `deletedAt` is
 * user/admin-initiated; `moderationDetachedAt` is a mandatory takedown that
 * hides it from everyone, decision admins included.
 */
export const isProposalReachable = (proposal: {
  deletedAt: string | null;
  moderationDetachedAt: string | null;
}): boolean => !proposal.deletedAt && !proposal.moderationDetachedAt;

/**
 * The phase a proposal would have moved into next — the one a rejection kept it
 * out of. Undefined when the process is on its last phase, when the current
 * phase is unknown, and when that next phase was never named: an author is
 * better told nothing than told "Unknown".
 */
export function getNextPhaseName({
  phases,
  currentPhaseId,
}: {
  phases: PhaseInstanceData[];
  currentPhaseId: string | null;
}): string | undefined {
  if (!currentPhaseId) {
    return undefined;
  }

  const currentIndex = phases.findIndex(
    (phase) => phase.phaseId === currentPhaseId,
  );

  return currentIndex === -1 ? undefined : phases[currentIndex + 1]?.name;
}

/**
 * Helper to check if proposals are allowed in the current phase.
 * Reads from instanceData phases which now contain all template fields.
 */
export function checkProposalsAllowed(
  phases: PhaseInstanceData[],
  currentPhaseId: string,
): { allowed: boolean; phaseName: string } {
  const phase = phases.find((p) => p.phaseId === currentPhaseId);
  if (!phase) {
    return { allowed: false, phaseName: 'Unknown' };
  }
  const allowed = phase.rules?.proposals?.submit !== false;
  return { allowed, phaseName: phase.name ?? 'Unknown' };
}
