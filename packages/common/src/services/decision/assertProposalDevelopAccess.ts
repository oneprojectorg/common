import { checkPermission, permission } from 'access-zones';

import { UnauthorizedError, ValidationError } from '../../utils';
import { type AccessUser, getProfileAccessRoles } from '../access';
import { decisionPermission } from './permissions';
import type { PhaseInstanceData } from './schemas/instanceData';
import { assertInstancePhase } from './utils/instance';
import { isDevelopPhase } from './utils/phaseSettings';

type DevelopInstance = {
  profileId: string | null;
  instanceData: { phases: readonly PhaseInstanceData[] };
};

const DEVELOP_ACCESS = [
  { profile: permission.ADMIN },
  { decisions: permission.ADMIN },
  { decisions: decisionPermission.DEVELOP_PROPOSALS },
];

/** Asserts a develop phase and admin or `decisionPermission.DEVELOP_PROPOSALS` on the instance profile, and returns the phase. */
export async function assertProposalDevelopAccess({
  instance,
  phaseId,
  user,
}: {
  instance: DevelopInstance;
  phaseId: string;
  user: AccessUser;
}): Promise<PhaseInstanceData> {
  if (!instance.profileId) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  const phase = assertInstancePhase({ instance, phaseId });

  if (!isDevelopPhase(phase)) {
    throw new ValidationError(
      `Proposals cannot be developed in the ${phase.name ?? 'Unknown'} phase`,
    );
  }

  const roles = await getProfileAccessRoles({
    user,
    profileId: instance.profileId,
  });

  if (!checkPermission(DEVELOP_ACCESS, roles)) {
    throw new UnauthorizedError('You cannot develop proposals in this phase');
  }

  return phase;
}
