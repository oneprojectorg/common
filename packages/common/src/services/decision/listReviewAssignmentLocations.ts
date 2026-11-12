import { and, db, eq } from '@op/db/client';
import type { ProposalReviewAssignmentStatus } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { CommonError, UnauthorizedError } from '../../utils';
import { assertProfileAccess, assertUserByAuthId } from '../assert';
import { getInstance } from './getInstance';
import { decisionPermission } from './permissions';
import {
  projectProposalLocation,
  proposalLocationColumns,
  proposalLocationWith,
} from './projectProposalLocation';
import { reviewerQueuePredicate } from './reviews/assignmentEligibility';
import {
  type ProposalLocations,
  proposalLocationsSchema,
} from './schemas/proposal';
import { assertInstancePhase } from './utils/instance';

/**
 * Every located proposal the caller is assigned to review — the pin source for
 * the reviewer's map. Read from the assignment side so the map can never plot
 * a proposal this reviewer was not assigned.
 */
export const listReviewAssignmentLocations = async ({
  processInstanceId,
  phaseId,
  status,
  user,
}: {
  processInstanceId: string;
  phaseId: string;
  status?: ProposalReviewAssignmentStatus;
  user: User;
}): Promise<ProposalLocations> => {
  const [instance, dbUser] = await Promise.all([
    getInstance({ instanceId: processInstanceId, user }),
    assertUserByAuthId(user.id),
  ]);

  const reviewerProfileId = dbUser.profileId;
  if (!reviewerProfileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  if (!instance.profileId) {
    throw new CommonError(
      'Decision instance does not have an associated profile',
    );
  }

  // No org fallback by design: that pattern is being retired.
  await assertProfileAccess({
    user,
    profileId: instance.profileId,
    permissions: [
      { decisions: decisionPermission.REVIEW },
      { decisions: permission.ADMIN },
    ],
  });

  assertInstancePhase({ instance, phaseId });

  const rows = await db.query.proposalReviewAssignments.findMany({
    columns: {},
    where: {
      // The queue's own set, so a pin goes whenever its card does.
      RAW: (t) =>
        and(
          reviewerQueuePredicate(t, {
            processInstanceId,
            phaseId,
            reviewerProfileId,
          }),
          status ? eq(t.status, status) : undefined,
        )!,
    },
    with: {
      proposal: {
        columns: proposalLocationColumns,
        with: proposalLocationWith,
      },
    },
  });

  // (instance, proposal, reviewer, phase) is unique, so no de-duplication.
  const proposals = rows.flatMap((row) =>
    projectProposalLocation(row.proposal),
  );

  return proposalLocationsSchema.parse({ items: proposals });
};
