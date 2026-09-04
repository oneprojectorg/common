import {
  type SQL,
  and,
  count as countFn,
  db,
  eq,
  exists,
  inArray,
  sql,
} from '@op/db/client';
import {
  ProposalReviewAssignmentStatus,
  proposalReviewAssignments,
  proposals,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import {
  CommonError,
  UnauthorizedError,
  decodeCursor,
  encodeCursor,
} from '../../utils';
import { assertProfileAccess, assertUserByAuthId } from '../assert';
import { generateProposalHtml } from './generateProposalHtml';
import { getInstance } from './getInstance';
import { getProposalDocumentsContent } from './getProposalDocumentsContent';
import { decisionPermission } from './permissions';
import { notSuperseded } from './proposalSupersession';
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
import { assertInstancePhase } from './utils/instance';
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

/**
 * Offset pagination behind an opaque cursor. The queue is bounded to one
 * reviewer's assignments, and the `leastReviewed` keys move under the reader
 * whenever anyone completes a review, so keyset would not stop skips either.
 */
type OffsetCursor = { offset: number };

/**
 * Returns one page of the reviewer's authorized review assignments in `phaseId`.
 */
export async function listReviewAssignments({
  processInstanceId,
  phaseId,
  status,
  categoryIds,
  proposalProfileId,
  sort = 'leastReviewed',
  cursor,
  limit,
  user,
}: {
  processInstanceId: string;
  phaseId: string;
  status?: ProposalReviewAssignmentStatus;
  /** Taxonomy term ids — limits results to assignments whose proposal is in any of the categories. */
  categoryIds?: string[];
  /** Profile id of a single proposal — limits results to that proposal's assignments. */
  proposalProfileId?: string;
  sort?: ReviewAssignmentSort;
  /** Opaque position from the previous page's `next`. */
  cursor?: string | null;
  limit: number;
  user: User;
}): Promise<ReviewAssignmentList> {
  const [instance, dbUser] = await Promise.all([
    getInstance({ instanceId: processInstanceId, user }),
    assertUserByAuthId(user.id),
  ]);

  const reviewerProfileId = dbUser.profileId;
  if (!reviewerProfileId) {
    throw new UnauthorizedError('User must have an active profile');
  }

  if (!instance.profileId) {
    throw new CommonError(
      'Decision instance does not have an associated profile',
    );
  }

  // No org fallback by design: that pattern is being retired.
  await assertProfileAccess({
    user,
    profileId: instance.profileId,
    permissions: [
      { decisions: decisionPermission.REVIEW },
      { decisions: permission.ADMIN },
    ],
  });

  assertInstancePhase({ instance, phaseId });

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
      return reviewAssignmentListSchema.parse({
        assignments: [],
        next: null,
        total: 0,
      });
    }
  }

  // COMPLETED reviews for the proposal across *all* reviewers — the same
  // "≥1 completed = reviewed" definition shown as the "N Reviewed" badge. A
  // correlated subquery (own `pra_completed` alias) so it isn't constrained by
  // the outer query's per-reviewer filter. Phase-scoped like the list, so the
  // badge and the sort count this phase's reviews only.
  const completedReviewCount = (t: typeof proposalReviewAssignments) =>
    sql<number>`(
      SELECT COUNT(*)::int FROM ${proposalReviewAssignments} AS pra_completed
      WHERE pra_completed.proposal_id = ${t.proposalId}
        AND pra_completed.process_instance_id = ${processInstanceId}
        AND pra_completed.phase_id = ${phaseId}
        AND pra_completed.status = ${ProposalReviewAssignmentStatus.COMPLETED}
    )`;

  // `::int` is required: the ranks bind untyped, and a text CASE sorts lexically.
  const statusRank = (t: typeof proposalReviewAssignments) =>
    sql<number>`(CASE ${t.status} ${sql.join(
      Object.entries(STATUS_SORT_RANK).map(
        ([value, rank]) => sql`WHEN ${value} THEN ${rank}`,
      ),
      sql` `,
    )} ELSE ${UNKNOWN_STATUS_RANK} END)::int`;

  // Stable per-reviewer shuffle: the constant reviewer prefix makes equally
  // reviewed proposals order differently for each reviewer (spreading review
  // coverage), while staying stable across refetches for a given reviewer.
  const reviewerShuffle = (t: typeof proposalReviewAssignments) =>
    sql<string>`md5(${reviewerProfileId} || ${t.proposalId}::text)`;

  // Shared by the page and the count so `total` describes the same set.
  const buildFilterConditions = (t: typeof proposalReviewAssignments): SQL =>
    and(
      eq(t.processInstanceId, processInstanceId),
      eq(t.reviewerProfileId, reviewerProfileId),
      eq(t.phaseId, phaseId),
      status ? eq(t.status, status) : undefined,
      categoryProposalIds
        ? inArray(t.proposalId, categoryProposalIds)
        : undefined,
      proposalProfileId
        ? exists(
            db
              .select({ id: proposals.id })
              .from(proposals)
              .where(
                and(
                  eq(proposals.id, t.proposalId),
                  eq(proposals.profileId, proposalProfileId),
                ),
              ),
          )
        : undefined,
      // Merging doesn't delete assignments, so a proposal merged mid-review
      // would otherwise stay in its reviewer's queue.
      notSuperseded({ proposalId: t.proposalId, processInstanceId }),
    )!;

  const offset = cursor ? decodeCursor<OffsetCursor>(cursor).offset : 0;

  const [rows, countResult] = await Promise.all([
    db.query.proposalReviewAssignments.findMany({
      where: { RAW: buildFilterConditions },
      with: reviewAssignmentWithConfig,
      offset,
      limit: limit + 1,
      // The `id` tie-break keeps page boundaries stable between equal keys.
      orderBy: (table, { asc, desc }) => {
        // Postgres puts NULLs first on DESC, which would let an undated
        // assignment lead the "newest" list.
        if (sort === 'newest') {
          return [sql`${table.assignedAt} DESC NULLS LAST`, desc(table.id)];
        }
        if (sort === 'oldest') {
          return [sql`${table.assignedAt} ASC NULLS LAST`, asc(table.id)];
        }
        return [
          asc(completedReviewCount(table)),
          asc(statusRank(table)),
          asc(reviewerShuffle(table)),
          asc(table.id),
        ];
      },
    }),
    db
      .select({ count: countFn() })
      .from(proposalReviewAssignments)
      .where(buildFilterConditions(proposalReviewAssignments)),
  ]);

  const total = Number(countResult[0]?.count ?? 0);
  const hasMore = rows.length > limit;
  const assignments = hasMore ? rows.slice(0, limit) : rows;

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
      // From the assignment's own phase, each of which can carry a rubric.
      rubricTemplate: getPhaseRubricTemplate(
        instance.instanceData,
        assignment.phaseId,
      ),
      review,
      revisionRequest: getActiveRevisionRequest(assignment.requests),
      canEditReview: canEditSubmittedReview({ assignment, instance, review }),
    };
  });

  const next = hasMore
    ? encodeCursor<OffsetCursor>({ offset: offset + limit })
    : null;

  return reviewAssignmentListSchema.parse({
    assignments: assignmentList,
    next,
    total,
  });
}
