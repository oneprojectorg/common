import { db } from '@op/db/client';
import type { ProposalReviewRequestState } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { UnauthorizedError } from '../../utils';
import { assertUserByAuthId } from '../assert';

/**
 * Author's inbox: revision requests across every proposal the caller
 * submitted. Scoped by identity (submittedByProfileId), not by instance
 * access — a user sees their own revisions regardless of decision.
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

  if (!commonUser.profileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  const proposals = await db.query.proposals.findMany({
    where: { submittedByProfileId: commonUser.profileId },
    with: {
      submittedBy: {
        with: {
          avatarImage: true,
        },
      },
      profile: true,
      processInstance: {
        columns: {},
        with: {
          profile: {
            columns: { slug: true },
          },
        },
      },
      reviewAssignments: {
        columns: { id: true },
        with: {
          requests: {
            where:
              states && states.length > 0
                ? { state: { in: states } }
                : undefined,
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      },
    },
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

  return { revisionRequests, processInstanceIds };
}
