import { checkPermission, permission } from 'access-zones';

import { UnauthorizedError, ValidationError } from '../../utils';
import { type AccessUser, getProfileAccessRoles } from '../access';
import { decisionPermission } from './permissions';
import type { DecisionInstanceData } from './schemas/instanceData';
import { isDevelopPhase } from './utils/phaseSettings';

type DevelopInstance = {
  profileId: string | null;
  instanceData: Pick<DecisionInstanceData, 'phases'>;
};

const DEVELOP_ACCESS = [
  { profile: permission.ADMIN },
  { decisions: permission.ADMIN },
  { decisions: decisionPermission.DEVELOP_PROPOSALS },
];

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

  const roles = await getProfileAccessRoles({
    user,
    profileId: instance.profileId,
  });

  if (!checkPermission(DEVELOP_ACCESS, roles)) {
    throw new UnauthorizedError('You cannot develop proposals in this phase');
  }
}
