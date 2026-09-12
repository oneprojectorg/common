import { trackRevisionRequestCancelled } from '@op/analytics';
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
import { and, eq } from 'drizzle-orm';

import { CommonError, NotFoundError, ValidationError } from '../../utils';
import { assertReviewAssignmentContext } from './reviewHelpers';

/** Cancels an active revision request and resumes a paused assignment. */
export async function cancelRevisionRequest({
  assignmentId,
  revisionRequestId,
  user,
}: {
  assignmentId: string;
  revisionRequestId: string;
  user: User;
}): Promise<
  ProposalReviewRequest & {
    processInstanceId: string;
    proposalId: string;
    proposalAssignmentIds: Array<string>;
  }
> {
  const context = await assertReviewAssignmentContext({
    assignmentId,
    user,
  });

  const existingRequest = context.revisionRequest;

  if (!existingRequest || existingRequest.id !== revisionRequestId) {
    throw new NotFoundError('Revision request', revisionRequestId);
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
      .where(
        and(
          eq(proposalReviewAssignments.id, assignmentId),
          eq(
            proposalReviewAssignments.status,
            ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
          ),
        ),
      );

    return cancelledRequest;
  });

  const requestedAtMs = request.createdAt
    ? Date.parse(request.createdAt)
    : Number.NaN;
  const secondsOpen = Number.isFinite(requestedAtMs)
    ? Math.round((Date.now() - requestedAtMs) / 1000)
    : null;

  waitUntil(
    trackRevisionRequestCancelled(
      user.id,
      context.assignment.processInstanceId,
      context.assignment.proposalId,
      {
        assignment_id: assignmentId,
        phase_id: context.assignment.phaseId,
        seconds_open: secondsOpen,
      },
    ),
  );

  return {
    ...request,
    processInstanceId: context.assignment.processInstanceId,
    proposalId: context.assignment.proposalId,
    proposalAssignmentIds: context.proposalAssignmentIds,
  };
}
