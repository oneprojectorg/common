import { db, sql } from '@op/db/client';
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
  canEditSubmittedReview,
  getActiveRevisionRequest,
  resolveAssignmentProposal,
  reviewAssignmentWithConfig,
} from './reviewHelpers';
import {
  type ReviewAssignmentList,
  type ReviewAssignmentSort,
  reviewAssignmentListSchema,
} from './schemas/reviews';
import { getPhaseRubricTemplate } from './utils/phaseTemplates';

/**
 * Status priority for the "least reviewed" secondary sort — lower ranks first,
 * so the most actionable work (resume in-progress, then items needing action)
 * surfaces ahead of not-started and completed within a review-count bucket.
 */
const STATUS_SORT_RANK: Record<string, number> = {
  [ProposalReviewAssignmentStatus.IN_PROGRESS]: 0,
  [ProposalReviewAssignmentStatus.READY_FOR_RE_REVIEW]: 1,
  [ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION]: 2,
  [ProposalReviewAssignmentStatus.PENDING]: 3,
  [ProposalReviewAssignmentStatus.COMPLETED]: 4,
} satisfies Record<ProposalReviewAssignmentStatus, number>;

/** Any unmapped (future) status sorts after all known ones. */
const UNKNOWN_STATUS_RANK = Object.keys(STATUS_SORT_RANK).length;

/** Returns all authorized review assignments for the current reviewer in a process instance. */
export async function listReviewAssignments({
  processInstanceId,
  status,
  categoryIds,
  sort = 'leastReviewed',
  user,
}: {
  processInstanceId: string;
  status?: string;
  /** Taxonomy term ids — limits results to assignments whose proposal is in any of the categories. */
  categoryIds?: string[];
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

  // Resolve the categories' proposal IDs up front (same approach as
  // resolveProposalListScope): assignments have no category column, so the
  // filter is an ID-set constraint on the snapshot's proposal, matching any
  // of the requested categories. Categories matching no proposals can't
  // match any assignment, so short-circuit.
  let categoryProposalIds: string[] | undefined;
  if (categoryIds && categoryIds.length > 0) {
    const proposalIdsInCategories = await db.query.proposalCategories.findMany({
      columns: { proposalId: true },
      where: {
        taxonomyTermId: { in: categoryIds },
        // Shared taxonomy terms can tag proposals in other instances; scope
        // here so the ID set passed to the assignment query stays tight.
        proposal: { processInstanceId },
      },
    });

    categoryProposalIds = proposalIdsInCategories.map((p) => p.proposalId);
    if (categoryProposalIds.length === 0) {
      return reviewAssignmentListSchema.parse({ assignments: [] });
    }
  }

  // COMPLETED reviews for the proposal across *all* reviewers — the same
  // "≥1 completed = reviewed" definition shown as the "N Reviewed" badge. A
  // correlated subquery (own `pra_completed` alias) so it isn't constrained by
  // the outer query's per-reviewer filter.
  const completedReviewCount = (t: typeof proposalReviewAssignments) =>
    sql<number>`(
      SELECT COUNT(*)::int FROM ${proposalReviewAssignments} AS pra_completed
      WHERE pra_completed.proposal_id = ${t.proposalId}
        AND pra_completed.process_instance_id = ${processInstanceId}
        AND pra_completed.status = ${ProposalReviewAssignmentStatus.COMPLETED}
    )`;

  const statusRank = (t: typeof proposalReviewAssignments) =>
    sql<number>`CASE ${t.status} ${sql.join(
      Object.entries(STATUS_SORT_RANK).map(
        ([value, rank]) => sql`WHEN ${value} THEN ${rank}`,
      ),
      sql` `,
    )} ELSE ${UNKNOWN_STATUS_RANK} END`;

  // Stable per-reviewer shuffle: the constant reviewer prefix makes equally
  // reviewed proposals order differently for each reviewer (spreading review
  // coverage), while staying stable across refetches for a given reviewer.
  const reviewerShuffle = (t: typeof proposalReviewAssignments) =>
    sql`md5(${dbUser.profileId} || ${t.proposalId}::text)`;

  const assignments = await db.query.proposalReviewAssignments.findMany({
    where: {
      processInstanceId,
      reviewerProfileId: dbUser.profileId,
      ...(status && { status }),
      ...(categoryProposalIds && {
        proposalId: { in: categoryProposalIds },
      }),
    },
    with: reviewAssignmentWithConfig,
    // The `id` tie-break gives a deterministic order when the primary keys are
    // equal (e.g. same `assignedAt`, or same coverage before the shuffle).
    orderBy: (table, { asc, desc }) => {
      if (sort === 'newest') {
        return [desc(table.assignedAt), desc(table.id)];
      }
      if (sort === 'oldest') {
        return [asc(table.assignedAt), asc(table.id)];
      }
      // 'leastReviewed': fewest completed reviews, then status priority, then
      // the stable per-reviewer shuffle.
      return [
        asc(completedReviewCount(table)),
        asc(statusRank(table)),
        asc(reviewerShuffle(table)),
      ];
    },
  });

  const proposalTemplate = await resolveProposalTemplate(
    instance.instanceData,
    instance.process.id,
  );

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

  const assignmentList = assignments.map((assignment) => {
    const proposalSnapshot = resolveAssignmentProposal(assignment);

    const documentContent = documentContentMap.get(proposalSnapshot.id);

    let htmlContent: Record<string, string> | undefined;
    if (documentContent?.type === 'json') {
      htmlContent = generateProposalHtml(documentContent.fragments);
    } else if (documentContent?.type === 'html') {
      htmlContent = { default: documentContent.content };
    }

    const review = assignment.reviews[0] ?? null;

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
      // Assignments in this list can span phases, each with its own rubric.
      rubricTemplate: getPhaseRubricTemplate(
        instance.instanceData,
        assignment.phaseId,
      ),
      review,
      revisionRequest: getActiveRevisionRequest(assignment.requests),
      canEditReview: canEditSubmittedReview({ assignment, instance, review }),
    };
  });

  return reviewAssignmentListSchema.parse({
    assignments: assignmentList,
  });
}
