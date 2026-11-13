import type { User } from '@op/supabase/lib';
import { checkPermission, permission } from 'access-zones';

import { NotFoundError } from '../../utils';
import { getProfileAccessRoles } from '../access';
import { isDevelopPhaseById } from './assertProposalDevelopAccess';
import { getCachedInstance } from './getCachedInstance';
import { getProposalDevelopAccess } from './getProposalDevelopAccess';
import { decisionPermission } from './permissions';
import { getInstancePhases } from './schemas/instanceData';
import type { PhaseProposalAccess } from './schemas/phaseProposalAccess';
import { checkProposalsAllowed } from './utils/proposal';

const SUBMIT_ACCESS = [
  { profile: permission.ADMIN },
  { decisions: decisionPermission.SUBMIT_PROPOSALS },
];

/**
 * Whether the caller may submit an ordinary proposal (`createProposal`) or
 * develop one (`createDevelopedProposal`) in the instance's current phase.
 */
export async function getPhaseProposalAccess({
  processInstanceId,
  user,
}: {
  processInstanceId: string;
  user: User;
}): Promise<PhaseProposalAccess> {
  const instance = await getCachedInstance(processInstanceId);

  if (!instance) {
    throw new NotFoundError('Process instance', processInstanceId);
  }

  const phaseId = instance.currentStateId;

  if (!phaseId || !instance.profileId) {
    return { canSubmit: false, canDevelop: false };
  }

  const phases = [...getInstancePhases(instance.instanceData)];

  const [roles, developAccess] = await Promise.all([
    getProfileAccessRoles({ user, profileId: instance.profileId }),
    getProposalDevelopAccess({ profileId: instance.profileId, user }),
  ]);

  return {
    canSubmit:
      checkProposalsAllowed(phases, phaseId).allowed &&
      checkPermission(SUBMIT_ACCESS, roles),
    canDevelop:
      developAccess.canDevelop &&
      isDevelopPhaseById({ instance: { instanceData: { phases } }, phaseId }),
  };
}
