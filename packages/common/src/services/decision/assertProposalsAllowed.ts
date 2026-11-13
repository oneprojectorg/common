import { ValidationError } from '../../utils';
import type { PhaseInstanceData } from './schemas/instanceData';
import { checkProposalsAllowed } from './utils/proposal';

/**
 * Asserts the caller may create or submit a proposal in the instance's
 * current phase.
 */
export function assertProposalsAllowed({
  phases,
  phaseId,
}: {
  phases: PhaseInstanceData[];
  phaseId: string;
}): void {
  const { allowed, phaseName } = checkProposalsAllowed(phases, phaseId);

  if (!allowed) {
    throw new ValidationError(
      `Proposals are not allowed in the ${phaseName} phase`,
    );
  }
}
