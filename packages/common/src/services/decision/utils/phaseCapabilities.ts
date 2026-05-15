import type { PhaseInstanceData } from '../schemas/instanceData';

export type PhaseProposalCapabilities = {
  canSubmit: boolean;
  canEdit: boolean;
  canReview: boolean;
};

/**
 * Materializes a phase's proposal-related capabilities from its `rules`.
 * Undefined rules preserve legacy behavior (allowed); only an explicit `false`
 * disables a capability.
 */
export function getPhaseProposalCapabilities(
  phase: PhaseInstanceData | null | undefined,
): PhaseProposalCapabilities {
  return {
    canSubmit: phase?.rules?.proposals?.submit !== false,
    canEdit: phase?.rules?.proposals?.edit !== false,
    canReview: phase?.rules?.proposals?.review !== false,
  };
}
