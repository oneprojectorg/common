import { and, db, eq, isNull } from '@op/db/client';
import type { ProposalReviewRequestState } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { assertUserByAuthId } from '../assert';
import { getInstance } from './getInstance';
import {
  assertProposalReviewReadAccess,
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
  // The proposal read doesn't depend on the caller's profile — resolve both at
  // once, as `assertReviewAssignmentContext` does.
  const [proposal, commonUser] = await Promise.all([
    db.query.proposals.findFirst({
      // Detached (CSAM) proposals return 404 — authors and reviewers alike
      // should not see revision history on a taken-down row.
      where: {
        RAW: (table) =>
          and(eq(table.id, proposalId), isNull(table.moderationDetachedAt))!,
      },
      with: proposalWithRevisionRequestsConfig(states),
    }),
    assertUserByAuthId(user.id),
  ]);

  if (!commonUser.profileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  if (!proposal) {
    throw new NotFoundError('Proposal', proposalId);
  }

  const instance = await getInstance({
    instanceId: proposal.processInstanceId,
    user,
  });

  await assertProposalReviewReadAccess({
    subject: 'revision requests',
    instance,
    profileId: commonUser.profileId,
    proposal,
    user,
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
