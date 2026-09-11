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
import { and, eq, inArray } from 'drizzle-orm';

import { CommonError, ValidationError } from '../../utils';
import {
  assertReviewAssignmentContext,
  assertReviewAssignmentPhaseIsCurrent,
} from './reviewHelpers';

/** Creates a revision request for one reviewer's assignment. */
export async function requestRevision({
  assignmentId,
  requestComment,
  user,
}: {
  assignmentId: string;
  requestComment: string;
  user: User;
}): Promise<
  ProposalReviewRequest & { processInstanceId: string; proposalId: string }
> {
  const context = await assertReviewAssignmentContext({
    assignmentId,
    user,
  });

  // A past-phase request would open a revision cycle nobody may complete.
  assertReviewAssignmentPhaseIsCurrent(
    context.instance,
    context.assignment.phaseId,
  );

  const request = await db.transaction(async (tx) => {
    const openRequest = await tx.query.proposalReviewRequests.findFirst({
      where: {
        assignmentId,
        state: ProposalReviewRequestState.REQUESTED,
      },
      columns: { id: true },
    });

    if (openRequest) {
      throw new ValidationError(
        'A revision has already been requested for this assignment',
      );
    }

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
      .where(
        and(
          eq(proposalReviewAssignments.id, assignmentId),
          inArray(proposalReviewAssignments.status, [
            ProposalReviewAssignmentStatus.PENDING,
            ProposalReviewAssignmentStatus.IN_PROGRESS,
          ]),
        ),
      );

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
    proposalId: context.assignment.proposalId,
  };
}
