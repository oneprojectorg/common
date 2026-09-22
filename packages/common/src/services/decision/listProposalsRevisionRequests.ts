import { and, db, eq, or } from '@op/db/client';
import type { ProposalReviewRequestState } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { UnauthorizedError } from '../../utils';
import { assertUserByAuthId } from '../assert';
import { notSuperseded } from './proposalSupersession';
import { isProposalProfileMember } from './proposalVisibility';
import { proposalWithRevisionRequestsConfig } from './reviewHelpers';

/**
 * Author's inbox: revision requests across every proposal the caller authored —
 * the ones they submitted plus the ones they collaborate on (a role on the
 * proposal's own profile). Scoped by identity, not by instance access — a user
 * sees their own revisions regardless of decision.
 *
 * For the proposal-scoped view (one proposal, anyone with instance
 * access), use listProposalRevisionRequests.
 */
export async function listProposalsRevisionRequests({
  states,
  user,
}: {
  states?: ProposalReviewRequestState[];
  user: User;
}) {
  const commonUser = await assertUserByAuthId(user.id);

  const { profileId } = commonUser;

  if (!profileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  const proposals = await db.query.proposals.findMany({
    where: {
      // A merged-away proposal is out of the review process, so its author has
      // nothing left to action. The authorship union stays in SQL so the scope
      // survives pagination.
      RAW: (table) =>
        and(
          or(
            eq(table.submittedByProfileId, profileId),
            isProposalProfileMember(table, user.id),
          )!,
          notSuperseded({
            proposalId: table.id,
            processInstanceId: table.processInstanceId,
          }),
        )!,
    },
    with: proposalWithRevisionRequestsConfig(states),
  });

  const revisionRequests = proposals.flatMap((proposal) => {
    const decisionProfileSlug = proposal.processInstance.profile?.slug ?? '';

    return proposal.reviewAssignments.flatMap((assignment) =>
      assignment.requests.map((request) => ({
        revisionRequest: request,
        proposal,
        decisionProfileSlug,
      })),
    );
  });

  const processInstanceIds = Array.from(
    new Set(proposals.map((proposal) => proposal.processInstanceId)),
  );

  return { items: revisionRequests, processInstanceIds };
}
