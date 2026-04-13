import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';

import { NotFoundError, UnauthorizedError, ValidationError } from '../../utils';
import { assertUserByAuthId } from '../assert';
import { getInstance } from './getInstance';
import { type ProposalData, parseProposalData } from './proposalDataSchema';

/** Loads and authorizes access to a single review assignment for the current reviewer. */
export async function assertReviewAssignmentContext({
  assignmentId,
  user,
}: {
  assignmentId: string;
  user: User;
}) {
  const [assignment, dbUser] = await Promise.all([
    db.query.proposalReviewAssignments.findFirst({
      where: {
        id: assignmentId,
      },
      with: {
        assignedProposalHistory: {
          with: {
            submittedBy: {
              with: {
                avatarImage: true,
              },
            },
            profile: true,
          },
        },
        proposal: {
          with: {
            submittedBy: {
              with: {
                avatarImage: true,
              },
            },
            profile: true,
          },
        },
        reviews: true,
      },
    }),
    assertUserByAuthId(user.id),
  ]);

  if (!assignment) {
    throw new NotFoundError('Review assignment');
  }

  if (!dbUser.profileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  const instance = await getInstance({
    instanceId: assignment.processInstanceId,
    user,
  });

  // TODO: revisit the access here
  if (!instance.access.review && !instance.access.admin) {
    throw new UnauthorizedError("You don't have access to review proposals");
  }

  if (assignment.reviewerProfileId !== dbUser.profileId) {
    throw new UnauthorizedError(
      "You don't have access to this review assignment",
    );
  }

  return {
    assignment,
    instance,
    review: assignment.reviews[0] ?? null,
    rubricTemplate: instance.instanceData.rubricTemplate ?? null,
  };
}

/**
 * Resolves the effective proposal snapshot from a review assignment
 * and parses/validates its proposal data.
 */
export function resolveAssignmentProposal(assignment: {
  assignedProposalHistory: {
    proposalData: unknown;
  } | null;
  proposal: {
    id: string;
    proposalData: unknown;
  };
}): {
  proposalSnapshot: { proposalData: ProposalData };
  proposalId: string;
} {
  const snapshot = assignment.assignedProposalHistory ?? assignment.proposal;
  const proposalId = assignment.proposal.id;

  const proposalData = parseProposalData(snapshot.proposalData);

  if (!proposalData.collaborationDocId) {
    throw new ValidationError(
      `Proposal ${proposalId} is missing collaborationDocId`,
    );
  }

  if (proposalData.collaborationDocVersionId == null) {
    console.warn(`Proposal ${proposalId} is missing collaborationDocVersionId`);
  }

  return {
    proposalSnapshot: { ...snapshot, proposalData },
    proposalId,
  };
}
