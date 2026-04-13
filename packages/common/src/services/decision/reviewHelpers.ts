import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';

import { NotFoundError, UnauthorizedError, ValidationError } from '../../utils';
import { assertUserByAuthId } from '../assert';
import { getInstance } from './getInstance';
import { parseProposalData } from './proposalDataSchema';

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
 * Resolves the effective proposal snapshot from a review assignment,
 * parses and validates proposal data, and returns the content ID
 * used for document lookups.
 */
export function resolveAssignmentProposal(assignment: {
  assignedProposalHistory: {
    historyId: string;
    proposalData: unknown;
  } | null;
  proposal: {
    id: string;
    proposalData: unknown;
  };
}) {
  const proposalHistory = assignment.assignedProposalHistory;
  const proposalSnapshot = proposalHistory ?? assignment.proposal;

  const contentId = proposalHistory
    ? proposalHistory.historyId
    : assignment.proposal.id;

  const parsedData = parseProposalData(proposalSnapshot.proposalData);

  if (!parsedData.collaborationDocId) {
    throw new ValidationError(
      `Proposal ${contentId} is missing collaborationDocId`,
    );
  }

  if (parsedData.collaborationDocVersionId == null) {
    console.warn(`Proposal ${contentId} is missing collaborationDocVersionId`);
  }

  return { proposalSnapshot, contentId, parsedData };
}
