import { db } from '@op/db/client';
import {
  ProposalReviewAssignmentStatus,
  ProposalReviewRequestState,
  proposalReviewAssignments,
  proposalReviewRequests,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { eq } from 'drizzle-orm';

import { CommonError, NotFoundError, ValidationError } from '../../utils';
import { assertReviewAssignmentContext } from './reviewHelpers';
import {
  type ProposalReviewRequest,
  proposalReviewRequestSchema,
} from './schemas/reviews';

/** Cancels an active revision request and resumes the assignment. */
export async function cancelRevisionRequest({
  assignmentId,
  revisionRequestId,
  user,
}: {
  assignmentId: string;
  revisionRequestId: string;
  user: User;
}): Promise<ProposalReviewRequest & { processInstanceId: string }> {
  const context = await assertReviewAssignmentContext({
    assignmentId,
    user,
  });

  const existingRequest = context.revisionRequest;

  if (!existingRequest || existingRequest.id !== revisionRequestId) {
    throw new NotFoundError('Revision request');
  }

  if (existingRequest.state !== ProposalReviewRequestState.REQUESTED) {
    throw new ValidationError('Only active revision requests can be cancelled');
  }

  const request = await db.transaction(async (tx) => {
    const [cancelledRequest] = await tx
      .update(proposalReviewRequests)
      .set({
        state: ProposalReviewRequestState.CANCELLED,
      })
      .where(eq(proposalReviewRequests.id, revisionRequestId))
      .returning();

    if (!cancelledRequest) {
      throw new CommonError('Failed to cancel revision request');
    }

    await tx
      .update(proposalReviewAssignments)
      .set({
        status: ProposalReviewAssignmentStatus.IN_PROGRESS,
      })
      .where(eq(proposalReviewAssignments.id, assignmentId));

    return cancelledRequest;
  });

  return {
    ...proposalReviewRequestSchema.parse(request),
    processInstanceId: context.assignment.processInstanceId,
  };
}
