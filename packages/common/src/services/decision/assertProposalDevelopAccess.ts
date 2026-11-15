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

export interface ProposalDevelopAccess {
  /** The develop phase that was checked. */
  phase: PhaseInstanceData;
  /** Profile Admin or decisions Admin on the instance profile. */
  isAdmin: boolean;
  /** Admin, or `decisionPermission.DEVELOP_PROPOSALS`. */
  canDevelop: boolean;
}

const ADMIN_ACCESS = [
  { profile: permission.ADMIN },
  { decisions: permission.ADMIN },
];

const DEVELOP_ACCESS = [
  ...ADMIN_ACCESS,
  { decisions: decisionPermission.DEVELOP_PROPOSALS },
];

/**
 * Resolves the caller's develop access on a develop phase without refusing a
 * caller who has none. Throws only when the phase is not a develop phase of the
 * instance, or the instance has no profile.
 */
export async function getProposalDevelopAccess({
  instance,
  phaseId,
  user,
}: {
  instance: DevelopInstance;
  phaseId: string;
  user: AccessUser;
}): Promise<ProposalDevelopAccess> {
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

  return {
    phase,
    isAdmin: checkPermission(ADMIN_ACCESS, roles),
    canDevelop: checkPermission(DEVELOP_ACCESS, roles),
  };
}

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
  const { phase, canDevelop } = await getProposalDevelopAccess({
    instance,
    phaseId,
    user,
  });

  if (!canDevelop) {
    throw new UnauthorizedError('Not authorized');
  }

  return phase;
}
