import { db } from '@op/db/client';
import { ProposalReviewRequestState } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { UnauthorizedError } from '../../utils';
import { assertUserByAuthId } from '../assert';

/**
 * Lists all pending revision requests across proposals authored by the current user.
 * Optionally filters to a single proposal when `proposalId` is provided.
 *
 * Returns raw data — encoding is handled by the API router.
 */
export async function listProposalsRevisionRequests({
  proposalId,
  user,
}: {
  proposalId?: string;
  user: User;
}) {
  const dbUser = await assertUserByAuthId(user.id);

  if (!dbUser.profileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  const proposals = await db.query.proposals.findMany({
    where: {
      submittedByProfileId: dbUser.profileId,
      ...(proposalId && { id: proposalId }),
    },
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
            where: {
              state: ProposalReviewRequestState.REQUESTED,
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

  const assignmentIds = revisionRequests.map(
    (r) => r.revisionRequest.assignmentId,
  );

  return { revisionRequests, assignmentIds };
}
