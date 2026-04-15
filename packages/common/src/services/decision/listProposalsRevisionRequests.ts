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
  const commonUser = await assertUserByAuthId(user.id);

  if (!commonUser.profileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  const proposals = await db.query.proposals.findMany({
    where: {
      submittedByProfileId: commonUser.profileId,
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

  const processInstanceIds = Array.from(
    new Set(proposals.map((proposal) => proposal.processInstanceId)),
  );

  return { revisionRequests, processInstanceIds };
}
