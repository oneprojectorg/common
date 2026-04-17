import { db } from '@op/db/client';
import type { ProposalReviewRequestState } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { assertUserByAuthId } from '../assert';
import { getInstance } from './getInstance';
import { proposalWithRevisionRequestsConfig } from './reviewHelpers';

/**
 * Proposal-scoped: revision requests on a single proposal. Visible to the
 * proposal author, any reviewer assigned to this proposal, and decision
 * admins. Other instance participants (voters, plain members with READ)
 * are rejected — revision feedback is reviewer-scoped.
 *
 * For the author's cross-proposal inbox, use listProposalsRevisionRequests.
 */
export async function listProposalRevisionRequests({
  proposalId,
  states,
  user,
}: {
  proposalId: string;
  states?: ProposalReviewRequestState[];
  user: User;
}) {
  const commonUser = await assertUserByAuthId(user.id);

  if (!commonUser.profileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  const proposal = await db.query.proposals.findFirst({
    where: { id: proposalId },
    with: proposalWithRevisionRequestsConfig(states),
  });

  if (!proposal) {
    throw new NotFoundError('Proposal not found');
  }

  const instance = await getInstance({
    instanceId: proposal.processInstanceId,
    user,
  });

  const isAuthor = proposal.submittedByProfileId === commonUser.profileId;
  const isAdmin = instance.access.admin;

  let isReviewer = false;
  if (!isAuthor && !isAdmin) {
    const assignment = await db.query.proposalReviewAssignments.findFirst({
      columns: { id: true },
      where: {
        proposalId: proposal.id,
        reviewerProfileId: commonUser.profileId,
      },
    });
    isReviewer = !!assignment;
  }

  if (!isAuthor && !isAdmin && !isReviewer) {
    throw new UnauthorizedError(
      "You don't have access to this proposal's revision requests",
    );
  }

  const decisionProfileSlug = proposal.processInstance.profile?.slug ?? '';

  const revisionRequests = proposal.reviewAssignments.flatMap((assignment) =>
    assignment.requests.map((request) => ({
      revisionRequest: request,
      proposal,
      decisionProfileSlug,
    })),
  );

  return {
    revisionRequests,
    processInstanceId: proposal.processInstanceId,
  };
}
