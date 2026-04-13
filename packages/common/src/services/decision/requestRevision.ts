import { db } from '@op/db/client';
import {
  ProposalReviewAssignmentStatus,
  ProposalReviewRequestState,
  proposalReviewAssignments,
  proposalReviewRequests,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { eq } from 'drizzle-orm';

import { CommonError, ValidationError } from '../../utils';
import { assertReviewAssignmentContext } from './reviewHelpers';
import {
  type ProposalReviewRequest,
  proposalReviewRequestSchema,
} from './schemas/reviews';

/** Creates a revision request and pauses the assignment until the author revises. */
export async function requestRevision({
  assignmentId,
  requestComment,
  user,
}: {
  assignmentId: string;
  requestComment: string;
  user: User;
}): Promise<ProposalReviewRequest & { processInstanceId: string }> {
  const context = await assertReviewAssignmentContext({
    assignmentId,
    user,
  });

  if (
    context.assignment.status ===
    ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION
  ) {
    throw new ValidationError(
      'A revision has already been requested for this assignment',
    );
  }

  if (context.assignment.status === ProposalReviewAssignmentStatus.COMPLETED) {
    throw new ValidationError(
      'Cannot request a revision for a completed assignment',
    );
  }

  const request = await db.transaction(async (tx) => {
    const [revisionRequest] = await tx
      .insert(proposalReviewRequests)
      .values({
        assignmentId,
        state: ProposalReviewRequestState.REQUESTED,
        requestComment,
      })
      .returning();

    if (!revisionRequest) {
      throw new CommonError('Failed to create revision request');
    }

    await tx
      .update(proposalReviewAssignments)
      .set({
        status: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
      })
      .where(eq(proposalReviewAssignments.id, assignmentId));

    return revisionRequest;
  });

  return {
    ...proposalReviewRequestSchema.parse(request),
    processInstanceId: context.assignment.processInstanceId,
  };
}
