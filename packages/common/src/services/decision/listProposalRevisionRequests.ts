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
 *
 * `phaseId` narrows the read to the assignments pinned to one phase. Pass the
 * instance's current phase on any screen that offers the author a resubmission
 * — that is the set `submitProposalRevision` will answer.
 */
export async function listProposalRevisionRequests({
  phaseId,
  proposalId,
  states,
  user,
}: {
  phaseId?: string;
  proposalId: string;
  states?: ProposalReviewRequestState[];
  user: User;
}) {
  const { proposal } = await loadProposalForReviewRead({
    proposalId,
    subject: 'revision requests',
    user,
    with: proposalWithRevisionRequestsConfig(states, phaseId),
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
    items: revisionRequests,
    processInstanceId: proposal.processInstanceId,
  };
}
