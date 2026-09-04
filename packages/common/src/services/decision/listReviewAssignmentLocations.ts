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
 * the reviewer's "Proposals to review" map.
 *
 * `listReviewAssignments` pages, so it can no longer supply the whole pin set,
 * and the map must plot all of them. This asks the question from the assignment
 * side rather than filtering the general pin read: the reviewer's own
 * assignment rows *are* the scope, so there is no client-supplied filter to get
 * wrong and no way to plot a proposal this reviewer was never assigned.
 */
export const listReviewAssignmentLocations = async ({
  processInstanceId,
  phaseId,
  status,
  user,
}: {
  processInstanceId: string;
  phaseId: string;
  /** Mirrors the queue's status filter so the pins match the cards. */
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
      // The queue drops an assignment whose proposal was merged away, so the
      // map has to as well or a pin outlives the card it belongs to.
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

  // `proposal_review_assignments_unique` covers (instance, proposal, reviewer,
  // phase) and this query pins all four, so a proposal can appear at most once
  // — no de-duplication needed.
  const proposals = rows.flatMap((row) => {
    const proposal = Array.isArray(row.proposal)
      ? row.proposal[0]
      : row.proposal;
    return proposal ? projectProposalLocation(proposal) : [];
  });

  return { proposals };
};
