import { UnauthorizedError, ValidationError } from '../../utils';
import type { AccessUser } from '../access';
import { getProposalDevelopAccess } from './getProposalDevelopAccess';
import type { DecisionInstanceData } from './schemas/instanceData';
import { isDevelopPhase } from './utils/phaseSettings';

type DevelopInstance = {
  profileId: string | null;
  instanceData: Pick<DecisionInstanceData, 'phases'>;
};

/** Whether `phaseId` is a develop phase of the instance. */
export function isDevelopPhaseById({
  instance,
  phaseId,
}: {
  instance: { instanceData: Pick<DecisionInstanceData, 'phases'> };
  phaseId: string | null;
}): boolean {
  const phase = instance.instanceData.phases.find((p) => p.phaseId === phaseId);
  return phase !== undefined && isDevelopPhase(phase);
}

/** Asserts a develop phase and admin or `decisionPermission.DEVELOP_PROPOSALS` on the instance profile. */
export async function assertProposalDevelopAccess({
  instance,
  phaseId,
  user,
}: {
  instance: DevelopInstance;
  phaseId: string;
  user: AccessUser;
}): Promise<void> {
  const phase = instance.instanceData.phases.find((p) => p.phaseId === phaseId);

  if (!phase || !isDevelopPhase(phase) || !instance.profileId) {
    throw new ValidationError(
      `Proposals are not allowed in the ${phase?.name ?? 'Unknown'} phase`,
    );
  }

  const { canDevelop } = await getProposalDevelopAccess({
    profileId: instance.profileId,
    user,
  });

  if (!canDevelop) {
    throw new UnauthorizedError('You cannot develop proposals in this phase');
  }
}
