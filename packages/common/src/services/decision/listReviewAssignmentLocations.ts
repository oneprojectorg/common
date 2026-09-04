import { db } from '@op/db/client';
import type { ProposalReviewAssignmentStatus } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { UnauthorizedError } from '../../utils';
import { assertUserByAuthId } from '../assert';
import { getInstance } from './getInstance';
import {
  projectProposalLocation,
  proposalLocationColumns,
  proposalLocationWith,
} from './projectProposalLocation';
import { notSuperseded } from './proposalSupersession';
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
}) => {
  const [instance, dbUser] = await Promise.all([
    getInstance({ instanceId: processInstanceId, user }),
    assertUserByAuthId(user.id),
  ]);

  const reviewerProfileId = dbUser.profileId;
  if (!reviewerProfileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  if (!instance.access.review && !instance.access.admin) {
    throw new UnauthorizedError("You don't have access to review proposals");
  }

  assertInstancePhase({ instance, phaseId });

  const rows = await db.query.proposalReviewAssignments.findMany({
    columns: {},
    where: {
      processInstanceId,
      reviewerProfileId,
      phaseId,
      ...(status && { status }),
      // Match the queue: a merged-away proposal gets no pin.
      RAW: (table) =>
        notSuperseded({
          proposalId: table.proposalId,
          processInstanceId,
        }),
    },
    with: {
      proposal: {
        columns: proposalLocationColumns,
        with: proposalLocationWith,
      },
    },
  });

  // (instance, proposal, reviewer, phase) is unique, so no de-duplication.
  const proposals = rows.flatMap((row) => {
    const proposal = Array.isArray(row.proposal)
      ? row.proposal[0]
      : row.proposal;
    return proposal ? projectProposalLocation(proposal) : [];
  });

  return { proposals };
};
