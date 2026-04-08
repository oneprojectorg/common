import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { assertUserByAuthId } from '../assert';
import { getInstance } from './getInstance';

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
    review: assignment.reviews[0],
    rubricTemplate: instance.instanceData.rubricTemplate,
  };
}
