import { trackRevisionRequested } from '@op/analytics';
import { db } from '@op/db/client';
import {
  ProposalReviewAssignmentStatus,
  type ProposalReviewRequest,
  ProposalReviewRequestState,
  proposalReviewAssignments,
  proposalReviewRequests,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { waitUntil } from '@vercel/functions';
import { eq } from 'drizzle-orm';

import { CommonError, ValidationError } from '../../utils';
import {
  assertReviewAssignmentPhaseIsCurrent,
  assertReviewAssignmentContext,
} from './reviewHelpers';

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

  switch (context.assignment.status) {
    case ProposalReviewAssignmentStatus.PENDING:
    case ProposalReviewAssignmentStatus.IN_PROGRESS:
      break;
    case ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION:
      throw new ValidationError(
        'A revision has already been requested for this assignment',
      );
    case ProposalReviewAssignmentStatus.COMPLETED:
      throw new ValidationError(
        'Cannot request a revision for a completed assignment',
      );
  }

  // A past-phase request would open a revision cycle nobody may complete.
  await assertReviewAssignmentPhaseIsCurrent({
    assignment: context.assignment,
    error: new ValidationError(
      'A revision can no longer be requested because the review phase has ended',
    ),
  });

  const request = await db.transaction(async (tx) => {
    const [revisionRequest] = await tx
      .insert(proposalReviewRequests)
      .values({
        assignmentId,
        state: ProposalReviewRequestState.REQUESTED,
        requestComment,
        requestedProposalHistoryId:
          context.assignment.assignedProposalHistoryId,
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

  waitUntil(
    trackRevisionRequested(
      user.id,
      context.assignment.processInstanceId,
      context.assignment.proposalId,
      {
        assignment_id: assignmentId,
        phase_id: context.assignment.phaseId,
      },
    ),
  );

  return {
    ...request,
    processInstanceId: context.assignment.processInstanceId,
  };
}
