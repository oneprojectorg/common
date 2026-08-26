import { and, db, eq } from '@op/db/client';
import {
  ProposalReviewAssignmentStatus,
  proposalReviewAssignments,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { CommonError, NotFoundError, ValidationError } from '../../utils';
import { assertProfileAccess } from '../assert';
import { getInstance } from './getInstance';
import { assertReviewAssignmentPhaseIsCurrent } from './reviewHelpers';
import type { InstancePhaseRef } from './schemas/instance';
import { assertInstancePhase } from './utils/instance';

export interface RemoveReviewAssignmentInput extends InstancePhaseRef {
  assignmentId: string;
  user: User;
}

export interface RemoveReviewAssignmentResult {
  removedCount: number;
}

/**
 * Distinct from the generic phase-ended refusal: the admin sees it as a toast
 * when a reviewer starts the review while the actions menu is open.
 */
const REVIEW_STARTED_MESSAGE =
  'This reviewer has already started this review, so the assignment can no longer be unassigned';

/**
 * The inverse of `assignPhaseReviews`: an admin drops ONE review assignment
 * that nobody has started. A hard delete, with no tombstone — an assignment
 * carries no history of its own worth keeping.
 *
 * PENDING is the only removable status. `decision_proposal_reviews` and
 * `decision_proposal_review_requests` both cascade off `assignmentId`, so
 * deleting an assignment a reviewer has touched would silently destroy their
 * draft or submitted review; every other status is refused instead.
 */
export async function removeReviewAssignment({
  processInstanceId,
  phaseId,
  assignmentId,
  user,
}: RemoveReviewAssignmentInput): Promise<RemoveReviewAssignmentResult> {
  const instance = await getInstance({ instanceId: processInstanceId, user });

  if (!instance.profileId) {
    throw new CommonError(
      'Decision instance does not have an associated profile',
    );
  }

  await assertProfileAccess({
    user,
    profileId: instance.profileId,
    permissions: { decisions: permission.ADMIN },
  });

  assertInstancePhase({ instance, phaseId });
  // Assignments survive a phase advance, so the phase must still be current —
  // the same posture as the review writes in `reviewHelpers`.
  assertReviewAssignmentPhaseIsCurrent(instance, phaseId);

  const assignment = await db.query.proposalReviewAssignments.findFirst({
    where: { id: assignmentId },
    columns: {
      id: true,
      processInstanceId: true,
      phaseId: true,
      status: true,
    },
  });

  // A row belonging to another instance or phase is not the caller's to
  // remove, and saying so would leak it — 404 for all three cases.
  if (
    !assignment ||
    assignment.processInstanceId !== processInstanceId ||
    assignment.phaseId !== phaseId
  ) {
    throw new NotFoundError('Review assignment', assignmentId);
  }

  if (assignment.status !== ProposalReviewAssignmentStatus.PENDING) {
    throw new ValidationError(REVIEW_STARTED_MESSAGE);
  }

  // The PENDING predicate is repeated on the DELETE so a row the reviewer
  // started between the read above and this statement keeps its review.
  const deleted = await db
    .delete(proposalReviewAssignments)
    .where(
      and(
        eq(proposalReviewAssignments.id, assignmentId),
        eq(
          proposalReviewAssignments.status,
          ProposalReviewAssignmentStatus.PENDING,
        ),
      ),
    )
    .returning({ id: proposalReviewAssignments.id });

  if (deleted.length === 0) {
    throw new ValidationError(REVIEW_STARTED_MESSAGE);
  }

  return { removedCount: deleted.length };
}
