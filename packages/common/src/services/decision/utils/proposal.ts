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
