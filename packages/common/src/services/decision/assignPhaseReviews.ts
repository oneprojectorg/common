import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { assertInstanceProfileAccess } from '../access';
import { assignReviewsToReviewer } from './assignReviewsToReviewer';
import { getInstance } from './getInstance';
import type { InstancePhaseRef } from './schemas/instance';

export interface AssignPhaseReviewsInput extends InstancePhaseRef {
  reviewerProfileId: string;
  proposalIds: string[];
  user: User;
}

/**
 * The decision-scoped counterpart of `platform.admin.assignReviews`.
 * Returns the number of assignments created.
 */
export async function assignPhaseReviews({
  processInstanceId,
  phaseId,
  reviewerProfileId,
  proposalIds,
  user,
}: AssignPhaseReviewsInput): Promise<number> {
  const instance = await getInstance({ instanceId: processInstanceId, user });

  await assertInstanceProfileAccess({
    user,
    instance,
    profilePermissions: { decisions: permission.ADMIN },
    orgFallbackPermissions: { decisions: permission.ADMIN },
  });

  return assignReviewsToReviewer({
    instanceId: processInstanceId,
    phaseId,
    reviewerProfileId,
    proposalIds,
  });
}
