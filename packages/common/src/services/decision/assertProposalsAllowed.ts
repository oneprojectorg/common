import { ValidationError } from '../../utils';
import type { DecisionInstanceData } from './schemas/instanceData';
import { checkProposalsAllowed } from './utils/proposal';

/**
 * Asserts the caller may create or submit a proposal in the instance's
 * current phase.
 */
export function assertProposalsAllowed({
  instance,
  phaseId,
}: {
  instance: { instanceData: Pick<DecisionInstanceData, 'phases'> };
  phaseId: string;
}): void {
  const { allowed, phaseName } = checkProposalsAllowed(
    instance.instanceData.phases,
    phaseId,
  );

  if (!allowed) {
    throw new ValidationError(
      `Proposals are not allowed in the ${phaseName} phase`,
    );
  }
}
