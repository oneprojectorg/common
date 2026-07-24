import { and, count, db, eq, inArray } from '@op/db/client';
import {
  ProposalReviewAssignmentStatus,
  proposalReviewAssignments,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { UnauthorizedError } from '../../utils';
import { assertUserByAuthId } from '../assert';
import { generateProposalHtml } from './generateProposalHtml';
import { getInstance } from './getInstance';
import { getProposalDocumentsContent } from './getProposalDocumentsContent';
import { resolveProposalTemplate } from './resolveProposalTemplate';
import {
  type ReviewAssignmentSort,
  sortByLeastReviewed,
} from './reviewAssignmentSort';
import {
  getActiveRevisionRequest,
  resolveAssignmentProposal,
  reviewAssignmentWithConfig,
} from './reviewHelpers';
import {
  type ReviewAssignmentList,
  reviewAssignmentListSchema,
} from './schemas/reviews';

/**
 * Status priority for the "least reviewed" secondary sort — lower ranks first.
 * Orders the reviewer's queue by how actionable each item is: resume
 * in-progress work, then items needing action, then not-started, then done.
 */
const STATUS_SORT_RANK: Record<string, number> = {
  [ProposalReviewAssignmentStatus.IN_PROGRESS]: 0,
  [ProposalReviewAssignmentStatus.READY_FOR_RE_REVIEW]: 1,
  [ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION]: 2,
  [ProposalReviewAssignmentStatus.PENDING]: 3,
  [ProposalReviewAssignmentStatus.COMPLETED]: 4,
} satisfies Record<ProposalReviewAssignmentStatus, number>;

/**
 * Counts COMPLETED review assignments per proposal across all reviewers in the
 * instance — the same "≥1 completed assignment = reviewed" definition surfaced
 * as the "N Reviewed" badge. Used to order the reviewer queue by coverage.
 */
async function getCompletedReviewCounts(
  processInstanceId: string,
  proposalIds: string[],
): Promise<Map<string, number>> {
  if (proposalIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      proposalId: proposalReviewAssignments.proposalId,
      completed: count(),
    })
    .from(proposalReviewAssignments)
    .where(
      and(
        eq(proposalReviewAssignments.processInstanceId, processInstanceId),
        inArray(proposalReviewAssignments.proposalId, proposalIds),
        eq(
          proposalReviewAssignments.status,
          ProposalReviewAssignmentStatus.COMPLETED,
        ),
      ),
    )
    .groupBy(proposalReviewAssignments.proposalId);

  return new Map(rows.map((row) => [row.proposalId, Number(row.completed)]));
}

/** Returns all authorized review assignments for the current reviewer in a process instance. */
export async function listReviewAssignments({
  processInstanceId,
  status,
  sort = 'leastReviewed',
  user,
}: {
  processInstanceId: string;
  status?: string;
  sort?: ReviewAssignmentSort;
  user: User;
}): Promise<ReviewAssignmentList> {
  const [instance, dbUser] = await Promise.all([
    getInstance({ instanceId: processInstanceId, user }),
    assertUserByAuthId(user.id),
  ]);

  if (!dbUser.profileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  if (!instance.access.review && !instance.access.admin) {
    throw new UnauthorizedError("You don't have access to review proposals");
  }

  const assignments = await db.query.proposalReviewAssignments.findMany({
    where: {
      processInstanceId,
      reviewerProfileId: dbUser.profileId,
      ...(status && { status }),
    },
    with: reviewAssignmentWithConfig,
    // `assignedAt asc` is the base order for date sorts and the stable seed the
    // "least reviewed" re-sort below builds on. This list is never paginated,
    // so the coverage-based re-order can safely happen in memory.
    orderBy: {
      assignedAt: sort === 'newest' ? 'desc' : 'asc',
    },
  });

  const orderedAssignments =
    sort === 'leastReviewed'
      ? await sortAssignmentsByLeastReviewed(
          assignments,
          processInstanceId,
          dbUser.profileId,
        )
      : assignments;

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

  for (const assignment of assignments) {
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

  const assignmentList = orderedAssignments.map((assignment) => {
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

  return reviewAssignmentListSchema.parse({
    assignments: assignmentList,
  });
}

/**
 * Re-orders the reviewer's assignments by review coverage: least-reviewed
 * proposals first, then the reviewer's status priority within each bucket, then
 * a stable per-reviewer random tiebreak (see {@link sortByLeastReviewed}).
 */
async function sortAssignmentsByLeastReviewed<
  T extends { proposalId: string; status: string },
>(
  assignments: T[],
  processInstanceId: string,
  reviewerProfileId: string,
): Promise<T[]> {
  const completedCounts = await getCompletedReviewCounts(
    processInstanceId,
    assignments.map((assignment) => assignment.proposalId),
  );

  return sortByLeastReviewed(
    assignments.map((assignment) => ({
      assignment,
      proposalId: assignment.proposalId,
      completedReviewCount: completedCounts.get(assignment.proposalId) ?? 0,
      statusRank:
        STATUS_SORT_RANK[assignment.status] ?? Number.MAX_SAFE_INTEGER,
    })),
    reviewerProfileId,
  ).map((item) => item.assignment);
}
