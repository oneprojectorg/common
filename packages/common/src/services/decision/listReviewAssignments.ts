import { and, db, eq } from '@op/db/client';
import { proposalReviewAssignments } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { count as countFn } from 'drizzle-orm';

import {
  UnauthorizedError,
  decodeCursor,
  encodeCursor,
  getCursorCondition,
} from '../../utils';
import { assertUserByAuthId } from '../assert';
import { generateProposalHtml } from './generateProposalHtml';
import { getInstance } from './getInstance';
import { getProposalDocumentsContent } from './getProposalDocumentsContent';
import { resolveProposalTemplate } from './resolveProposalTemplate';
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
 * Returns the current reviewer's authorized review assignments in a process
 * instance, keyset-paginated on `assignedAt + id`. The per-row TipTap doc
 * hydration that used to run over the reviewer's entire assignment set now
 * only runs over one page, which is what keeps large queues from timing out.
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

  // Cursor lives only on the data query so `total` stays the full match count.
  const [rawAssignments, countResult] = await Promise.all([
    db.query.proposalReviewAssignments.findMany({
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
    }),
    db
      .select({ count: countFn() })
      .from(proposalReviewAssignments)
      .where(
        and(
          eq(proposalReviewAssignments.processInstanceId, processInstanceId),
          eq(proposalReviewAssignments.reviewerProfileId, reviewerProfileId),
          status ? eq(proposalReviewAssignments.status, status) : undefined,
        ),
      ),
  ]);

  const total = Number(countResult[0]?.count ?? 0);
  const hasMore = rawAssignments.length > limit;
  const pageAssignments = hasMore
    ? rawAssignments.slice(0, limit)
    : rawAssignments;

  const proposalTemplate = await resolveProposalTemplate(
    instance.instanceData,
    instance.process.id,
  );
  const rubricTemplate = instance.instanceData.rubricTemplate ?? null;

  const docContentInputs: Array<{
    id: string;
    proposalData: unknown;
    proposalTemplate: typeof proposalTemplate;
    collaborationDocVersionId?: number;
  }> = [];

  for (const assignment of pageAssignments) {
    const proposalSnapshot = resolveAssignmentProposal(assignment);

    docContentInputs.push({
      id: proposalSnapshot.id,
      proposalData: proposalSnapshot.proposalData,
      proposalTemplate,
      collaborationDocVersionId:
        proposalSnapshot.proposalData.collaborationDocVersionId,
    });
  }

  const documentContentMap = await getProposalDocumentsContent(
    docContentInputs,
    // A single unavailable document must not break the whole list.
    { onFetchError: 'omit' },
  );

  const assignmentList = pageAssignments.map((assignment) => {
    const proposalSnapshot = resolveAssignmentProposal(assignment);

    const documentContent = documentContentMap.get(proposalSnapshot.id);

    let htmlContent: Record<string, string> | undefined;
    if (documentContent?.type === 'json') {
      htmlContent = generateProposalHtml(documentContent.fragments);
    } else if (documentContent?.type === 'html') {
      htmlContent = { default: documentContent.content };
    }

    return {
      assignment: {
        ...assignment,
        proposal: {
          ...proposalSnapshot,
          proposalTemplate,
          documentContent,
          htmlContent,
        },
      },
      rubricTemplate,
      review: assignment.reviews[0] ?? null,
      revisionRequest: getActiveRevisionRequest(assignment.requests),
    };
  });

  const lastAssignment = pageAssignments[pageAssignments.length - 1];
  const cursorValue = lastAssignment?.assignedAt;
  // `!= null` (not a truthy check) so a falsy-but-valid sort value still
  // produces a cursor instead of silently ending pagination.
  const next =
    hasMore && lastAssignment && cursorValue != null
      ? encodeCursor<{ value: string | Date; id: string }>({
          value: cursorValue,
          id: lastAssignment.id,
        })
      : null;

  return reviewAssignmentListSchema.parse({
    assignments: assignmentList,
    total,
    next,
  });
}
