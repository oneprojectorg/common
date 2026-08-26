import { and, db, eq, inArray } from '@op/db/client';
import {
  ProposalReviewAssignmentStatus,
  proposalReviewAssignments,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { CommonError, NotFoundError } from '../../utils';
import { assertProfileAccess } from '../assert';
import { getInstance } from './getInstance';
import { assertReviewAssignmentPhaseIsCurrent } from './reviewHelpers';
import type { InstancePhaseRef } from './schemas/instance';
import { assertInstancePhase } from './utils/instance';

export interface RemoveReviewAssignmentsInput extends InstancePhaseRef {
  assignmentIds: string[];
  user: User;
}

export interface RemoveReviewAssignmentsResult {
  removedCount: number;
  /** Requested rows left in place: already started, or already gone. */
  skippedIds: string[];
}

/**
 * The inverse of `assignPhaseReviews`: an admin drops review assignments
 * nobody has started. A hard delete, with no tombstone — an assignment
 * carries no history of its own worth keeping.
 *
 * PENDING is the only removable status. `decision_proposal_reviews` and
 * `decision_proposal_review_requests` both cascade off `assignmentId`, so
 * deleting an assignment a reviewer has touched would silently destroy their
 * draft or submitted review.
 *
 * Best-effort per row: a started or already-deleted assignment comes back in
 * `skippedIds` rather than failing the batch, so a double-click and a
 * reviewer starting mid-request both settle instead of erroring. Only the
 * caller's own mistakes throw — no access, a phase that has ended, or an id
 * from another instance or phase.
 */
export async function removeReviewAssignments({
  processInstanceId,
  phaseId,
  assignmentIds,
  user,
}: RemoveReviewAssignmentsInput): Promise<RemoveReviewAssignmentsResult> {
  const instance = await getInstance({ instanceId: processInstanceId, user });

  if (!instance.profileId) {
    throw new CommonError(
      'Decision instance does not have an associated profile',
    );
  }

  // Deliberately the generic gate with no org fallback: the org-fallback
  // `assertInstanceProfileAccess` is the legacy pattern being retired, so an
  // org admin needs a role on the decision's own profile to unassign.
  await assertProfileAccess({
    user,
    profileId: instance.profileId,
    permissions: { decisions: permission.ADMIN },
  });

  assertInstancePhase({ instance, phaseId });
  // Assignments survive a phase advance, so the phase must still be current —
  // the same posture as the review writes in `reviewHelpers`.
  assertReviewAssignmentPhaseIsCurrent(instance, phaseId);

  const requestedIds = [...new Set(assignmentIds)];

  const requested = await db.query.proposalReviewAssignments.findMany({
    where: { id: { in: requestedIds } },
    columns: { id: true, processInstanceId: true, phaseId: true },
  });

  // A row from another instance or phase is a client bug rather than a race,
  // so it fails the batch instead of being skipped. Naming it would leak a
  // row the caller may not read, hence the requested id.
  const foreign = requested.find(
    (assignment) =>
      assignment.processInstanceId !== processInstanceId ||
      assignment.phaseId !== phaseId,
  );
  if (foreign) {
    throw new NotFoundError('Review assignment', foreign.id);
  }

  // One statement, PENDING included: a row the reviewer starts between the
  // read above and this delete keeps its review and lands in `skippedIds`.
  const deleted = await db
    .delete(proposalReviewAssignments)
    .where(
      and(
        inArray(proposalReviewAssignments.id, requestedIds),
        eq(
          proposalReviewAssignments.status,
          ProposalReviewAssignmentStatus.PENDING,
        ),
      ),
    )
    .returning({ id: proposalReviewAssignments.id });

  const removedIds = new Set(deleted.map((row) => row.id));

  return {
    removedCount: removedIds.size,
    skippedIds: requestedIds.filter((id) => !removedIds.has(id)),
  };
}
