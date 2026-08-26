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
 * Hard-deletes review assignments. Reviews and revision requests cascade off
 * `assignmentId`, so a non-PENDING row is skipped rather than deleted.
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

  // No org fallback by design: that pattern is being retired.
  await assertProfileAccess({
    user,
    profileId: instance.profileId,
    permissions: { decisions: permission.ADMIN },
  });

  assertInstancePhase({ instance, phaseId });
  assertReviewAssignmentPhaseIsCurrent(instance, phaseId);

  const requestedIds = [...new Set(assignmentIds)];

  const requested = await db.query.proposalReviewAssignments.findMany({
    where: { id: { in: requestedIds } },
    columns: { id: true, processInstanceId: true, phaseId: true },
  });

  const foreign = requested.find(
    (assignment) =>
      assignment.processInstanceId !== processInstanceId ||
      assignment.phaseId !== phaseId,
  );
  if (foreign) {
    throw new NotFoundError('Review assignment', foreign.id);
  }

  // PENDING repeated here: a row started since the read above keeps its review.
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
