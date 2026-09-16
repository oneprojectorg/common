import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { UnauthorizedError } from '../../utils';
import { assertProfileAccess } from '../assert';
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
 *
 * Decision profile only, no org fallback: this is what the assignment reads
 * and `removeReviewAssignments` already assert, and a write must not be
 * reachable by a caller who cannot see what they are writing to.
 */
export async function assignPhaseReviews({
  processInstanceId,
  phaseId,
  reviewerProfileId,
  proposalIds,
  user,
}: AssignPhaseReviewsInput): Promise<number> {
  const instance = await getInstance({ instanceId: processInstanceId, user });

  if (!instance.profileId) {
    throw new UnauthorizedError("You don't have access to do this");
  }
  await assertProfileAccess({
    user,
    profileId: instance.profileId,
    permissions: { decisions: permission.ADMIN },
  });

  return assignReviewsToReviewer({
    instanceId: processInstanceId,
    phaseId,
    reviewerProfileId,
    proposalIds,
  });
}
