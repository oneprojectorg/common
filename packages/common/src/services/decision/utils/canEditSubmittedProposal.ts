import type { ProcessInstance } from '@op/db/schema';
import { checkPermission, permission } from 'access-zones';

import { CommonError } from '../../../utils';
import { getProfileAccessUser } from '../../access';
import type { DecisionInstanceData } from '../schemas/instanceData';
import { assertInstancePhase } from './instance';
import { getPhaseProposalCapabilities } from './phaseCapabilities';

/**
 * Whether a non-admin author may edit their submitted proposal on this
 * instance. Returns true for instance-profile admins, or when the current
 * phase's `proposals.edit` rule is not explicitly disabled. Callers must
 * gate on `status !== DRAFT` themselves — drafts are always author-editable.
 */
export async function canEditSubmittedProposalInPhase({
  user,
  processInstance,
}: {
  user: { id: string };
  processInstance: ProcessInstance;
}): Promise<boolean> {
  if (!processInstance.profileId) {
    throw new CommonError(
      `Process instance ${processInstance.id} is missing a profileId`,
    );
  }
  const instanceProfileUser = await getProfileAccessUser({
    user,
    profileId: processInstance.profileId,
  });
  const isInstanceAdmin = checkPermission(
    { profile: permission.ADMIN },
    instanceProfileUser?.roles ?? [],
  );
  if (isInstanceAdmin) {
    return true;
  }

  if (!processInstance.currentStateId) {
    throw new CommonError(
      `Process instance ${processInstance.id} is missing a currentStateId`,
    );
  }
  const instanceData = processInstance.instanceData as DecisionInstanceData;
  const currentPhase = assertInstancePhase({
    instance: { instanceData },
    phaseId: processInstance.currentStateId,
  });
  return getPhaseProposalCapabilities(currentPhase).canEdit;
}
