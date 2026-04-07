import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';

import { NotFoundError, UnauthorizedError, ValidationError } from '../../utils';
import { assertUserByAuthId } from '../assert';
import { getInstance } from './getInstance';
import type { RubricTemplateSchema } from './types';

/** Loads and authorizes access to a single review assignment for the current reviewer. */
export async function getAuthorizedReviewAssignmentContext({
  assignmentId,
  user,
}: {
  assignmentId: string;
  user: User;
}) {
  const [assignment, commonUser] = await Promise.all([
    db.query.proposalReviewAssignments.findFirst({
      where: {
        id: assignmentId,
      },
      with: {
        reviews: true,
      },
    }),
    assertUserByAuthId(user.id),
  ]);

  if (!assignment) {
    throw new NotFoundError('Review assignment');
  }

  if (!commonUser.profileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  const instance = await getInstance({
    instanceId: assignment.processInstanceId,
    user,
  });

  if (!instance.access.review && !instance.access.admin) {
    throw new UnauthorizedError("You don't have access to review proposals");
  }

  if (assignment.reviewerProfileId !== commonUser.profileId) {
    throw new UnauthorizedError(
      "You don't have access to this review assignment",
    );
  }

  const instanceData =
    instance.instanceData && typeof instance.instanceData === 'object'
      ? instance.instanceData
      : null;

  return {
    assignment,
    instance,
    review: assignment.reviews[0] ?? null,
    rubricTemplate:
      (instanceData?.rubricTemplate as RubricTemplateSchema | undefined) ??
      null,
  };
}

/** Returns the rubric template required to save or submit a review. */
export function requireRubricTemplate(
  rubricTemplate: RubricTemplateSchema | null,
): RubricTemplateSchema {
  if (!rubricTemplate) {
    throw new ValidationError(
      'Review rubric is not configured for this process',
    );
  }

  return rubricTemplate;
}
