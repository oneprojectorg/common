import { and, db, eq } from '@op/db/client';
import type { User } from '@op/supabase/lib';

import {
  UnauthorizedError,
  decodeCursor,
  encodeCursor,
  getCursorCondition,
} from '../../utils';
import { assertUserByAuthId } from '../assert';
import { getInstance } from './getInstance';
import {
  getActiveRevisionRequest,
  resolveAssignmentProposal,
  reviewAssignmentWithConfig,
} from './reviewHelpers';
import {
  type ReviewAssignmentList,
  reviewAssignmentListSchema,
} from './schemas/reviews';

interface ListReviewAssignmentsInput {
  processInstanceId: string;
  status?: string;
  dir?: 'asc' | 'desc';
  /** Cursor returned by a prior page's `next`; opaque to callers. */
  cursor?: string | null;
  /** Max items in this page (1–100, default 50). */
  limit?: number;
  user: User;
}

/**
 * Returns all authorized review assignments for the current reviewer in a
 * process instance. The response uses the lean
 * {@link ReviewAssignmentList} shape: the embedded proposal snapshot omits the
 * per-row TipTap doc payload (`documentContent` / `htmlContent`) and the
 * resolved `proposalTemplate`. The single-assignment endpoint
 * (`getReviewAssignment`) still returns the full proposal when the reviewer
 * opens an individual card.
 *
 * Pagination: keyset on `assignedAt + id` so a reviewer with hundreds of
 * assignments can page through them without loading the full set per request.
 */
export async function listReviewAssignments({
  processInstanceId,
  status,
  dir = 'asc',
  cursor,
  limit = 50,
  user,
}: ListReviewAssignmentsInput): Promise<ReviewAssignmentList> {
  const [instance, dbUser] = await Promise.all([
    getInstance({ instanceId: processInstanceId, user }),
    assertUserByAuthId(user.id),
  ]);

  const reviewerProfileId = dbUser.profileId;
  if (!reviewerProfileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  if (!instance.access.review && !instance.access.admin) {
    throw new UnauthorizedError("You don't have access to review proposals");
  }

  const decodedCursor = cursor
    ? decodeCursor<{ value: string | Date; id: string }>(cursor)
    : undefined;

  const rawAssignments = await db.query.proposalReviewAssignments.findMany({
    where: {
      RAW: (table) =>
        and(
          eq(table.processInstanceId, processInstanceId),
          eq(table.reviewerProfileId, reviewerProfileId),
          status ? eq(table.status, status) : undefined,
          getCursorCondition({
            column: table.assignedAt,
            tieBreakerColumn: table.id,
            cursor: decodedCursor,
            direction: dir,
          }),
        )!,
    },
    with: reviewAssignmentWithConfig,
    orderBy: (table, { asc, desc }) =>
      dir === 'asc'
        ? [asc(table.assignedAt), asc(table.id)]
        : [desc(table.assignedAt), desc(table.id)],
    // Fetch one extra to detect whether a next page exists.
    limit: limit + 1,
  });

  const hasMore = rawAssignments.length > limit;
  const pageAssignments = hasMore
    ? rawAssignments.slice(0, limit)
    : rawAssignments;
  const rubricTemplate = instance.instanceData.rubricTemplate ?? null;

  const assignmentList = pageAssignments.map((assignment) => {
    const proposalSnapshot = resolveAssignmentProposal(assignment);

    return {
      assignment: {
        ...assignment,
        proposal: proposalSnapshot,
      },
      rubricTemplate,
      review: assignment.reviews[0] ?? null,
      revisionRequest: getActiveRevisionRequest(assignment.requests),
    };
  });

  const lastAssignment = pageAssignments[pageAssignments.length - 1];
  const next =
    hasMore && lastAssignment?.assignedAt
      ? encodeCursor<{ value: string | Date; id: string }>({
          value: lastAssignment.assignedAt,
          id: lastAssignment.id,
        })
      : null;

  return reviewAssignmentListSchema.parse({
    assignments: assignmentList,
    next,
  });
}
