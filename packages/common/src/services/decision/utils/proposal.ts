import type { DecisionSchemaDefinition } from '../schemas/types';

/**
 * Helper to check if proposals are allowed in the current phase.
 */
export function checkProposalsAllowed(
  schema: DecisionSchemaDefinition,
  currentPhaseId: string,
): { allowed: boolean; phaseName: string } {
  const phase = schema.phases.find((p) => p.id === currentPhaseId);
  if (!phase) {
    return { allowed: false, phaseName: 'Unknown' };
  }
  const allowed = phase.rules?.proposals?.submit !== false;
  return { allowed, phaseName: phase.name };
}
