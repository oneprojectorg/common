import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { assertInstanceProfileAccess } from '../access';
import { getDecisionReviewAssignments } from './getDecisionReviewAssignments';
import { getInstance } from './getInstance';
import type { AdminDecisionReviewAssignments } from './schemas/adminDecisionInstance';
import type { InstancePhaseRef } from './schemas/instance';
import { assertInstancePhase } from './utils/instance';

/**
 * The `platform.admin.listDecisionReviewAssignments` read model, re-gated on
 * the instance's own admin capability.
 */
export async function getPhaseReviewAssignments(
  input: InstancePhaseRef & { user: User; reviewerProfileId?: string },
): Promise<AdminDecisionReviewAssignments> {
  const { user, processInstanceId, phaseId, reviewerProfileId } = input;

  const instance = await getInstance({ instanceId: processInstanceId, user });

  await assertInstanceProfileAccess({
    user,
    instance,
    profilePermissions: { decisions: permission.ADMIN },
    orgFallbackPermissions: { decisions: permission.ADMIN },
  });

  assertInstancePhase({ instance, phaseId });

  return getDecisionReviewAssignments({
    instanceId: processInstanceId,
    phaseId,
    reviewerProfileId,
  });
}
