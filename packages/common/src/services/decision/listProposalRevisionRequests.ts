import type { ProposalReviewRequestState } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import {
  loadProposalForReviewRead,
  proposalWithRevisionRequestsConfig,
} from './reviewHelpers';

/**
 * Proposal-scoped: revision requests on a single proposal. Visible to the
 * proposal author, decision admins, and any user with the REVIEW capability
 * on the instance. Other instance participants (voters, plain members with
 * READ) are rejected — revision feedback is reviewer-scoped.
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
  const { proposal } = await loadProposalForReviewRead({
    proposalId,
    subject: 'revision requests',
    user,
    with: proposalWithRevisionRequestsConfig(states),
  });

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
