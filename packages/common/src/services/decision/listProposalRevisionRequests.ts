import { db } from '@op/db/client';
import type { ProposalReviewRequestState } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { assertUserByAuthId } from '../assert';
import { getInstance } from './getInstance';

/**
 * Proposal-scoped: revision requests on a single proposal, gated by a
 * single getInstance access check — reviewers and decision admins see
 * it, not only the author.
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

  if (!proposal) {
    throw new NotFoundError('Proposal not found');
  }

  await getInstance({ instanceId: proposal.processInstanceId, user });

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
