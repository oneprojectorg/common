import {
  type SQL,
  and,
  count as countFn,
  db,
  eq,
  exists,
  gt,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from '@op/db/client';
import {
  ProposalReviewAssignmentStatus,
  proposalReviewAssignments,
  proposals,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { z } from 'zod';

import {
  UnauthorizedError,
  ValidationError,
  decodeCursor,
  encodeCursor,
} from '../../utils';
import { assertUserByAuthId } from '../assert';
import { generateProposalHtml } from './generateProposalHtml';
import { getInstance } from './getInstance';
import { getProposalDocumentsContent } from './getProposalDocumentsContent';
import { notSuperseded } from './proposalSupersession';
import { resolveProposalTemplate } from './resolveProposalTemplate';
import {
  canEditSubmittedReview,
  getActiveRevisionRequest,
  resolveAssignmentProposal,
  reviewAssignmentWithConfig,
} from './reviewHelpers';
import { PROPOSAL_PAGE_LIMIT } from './schemas/proposal';
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
 * `assignedAt` round-trips as the Postgres text form the driver hands back —
 * `2026-09-04 10:01:17.354004+00`, or `2026-01-01 00:00:00+00` with no
 * fractional part — not ISO 8601. Matched by shape rather than `Date.parse`,
 * which accepts `'0'` and `'2026'`: those satisfy the schema and then reach
 * Postgres as a timestamp comparison it rejects, which is the 500 this guards.
 */
const PG_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?[+-]\d{2}(:\d{2})?$/;

/** `newest` / `oldest` keyset position. `assignedAt` is nullable. */
const dateCursorSchema = z.object({
  assignedAt: z.string().regex(PG_TIMESTAMP).nullable(),
  id: z.uuid(),
});

/** `leastReviewed` keyset position — all four sort expressions. */
const coverageCursorSchema = z.object({
  completedReviewCount: z.number().int().nonnegative(),
  statusRank: z.number().int().nonnegative(),
  /** `md5()` output, so exactly 32 lowercase hex digits. */
  reviewerShuffle: z.string().regex(/^[0-9a-f]{32}$/),
  id: z.uuid(),
});

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
  // Defaulted here, not on the router input, so the client sends no `limit` and
  // the SSR and client query keys stay identical.
  limit = PROPOSAL_PAGE_LIMIT,
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
  /** Keyset position from the previous page's `next`. */
  cursor?: string | null;
  limit?: number;
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

  if (!instance.access.review && !instance.access.admin) {
    throw new UnauthorizedError("You don't have access to review proposals");
  }

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

  // `::int` is load-bearing: the ranks arrive as untyped bind params, so
  // without it Postgres types the CASE as text — which sorts the ranks
  // lexically and hands the cursor a string where it expects a number.
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

  // One builder for the page and the count, so `total` can never describe a
  // different set than the rows. Param'd on the table ref because the
  // relational `RAW` callback hands over an aliased table.
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

  const buildKeysetCondition = (
    t: typeof proposalReviewAssignments,
  ): SQL | undefined => {
    if (!cursor) {
      return undefined;
    }

    // `assignedAt` sorts NULLS LAST in both directions, so a cursor taken
    // inside the trailing NULL block can only continue by id — comparing the
    // NULL against a value would drop every remaining row.
    if (sort === 'newest') {
      const position = parseCursor(cursor, dateCursorSchema);
      if (position.assignedAt === null) {
        return and(isNull(t.assignedAt), lt(t.id, position.id))!;
      }
      return or(
        lt(t.assignedAt, position.assignedAt),
        isNull(t.assignedAt),
        and(eq(t.assignedAt, position.assignedAt), lt(t.id, position.id)),
      )!;
    }

    if (sort === 'oldest') {
      const position = parseCursor(cursor, dateCursorSchema);
      if (position.assignedAt === null) {
        return and(isNull(t.assignedAt), gt(t.id, position.id))!;
      }
      return or(
        gt(t.assignedAt, position.assignedAt),
        isNull(t.assignedAt),
        and(eq(t.assignedAt, position.assignedAt), gt(t.id, position.id)),
      )!;
    }

    // 'leastReviewed': the expanded lexicographic form of the four ascending
    // sort keys. All three expressions are deterministic for a given reviewer
    // and phase, so a position stays valid across pages.
    const position = parseCursor(cursor, coverageCursorSchema);
    const completed = completedReviewCount(t);
    const rank = statusRank(t);
    const shuffle = reviewerShuffle(t);

    return or(
      gt(completed, position.completedReviewCount),
      and(
        eq(completed, position.completedReviewCount),
        or(
          gt(rank, position.statusRank),
          and(
            eq(rank, position.statusRank),
            or(
              gt(shuffle, position.reviewerShuffle),
              and(eq(shuffle, position.reviewerShuffle), gt(t.id, position.id)),
            ),
          ),
        ),
      ),
    )!;
  };

  // The cursor narrows the page only — `total` stays the count for the filters.
  const [rows, countResult] = await Promise.all([
    db.query.proposalReviewAssignments.findMany({
      where: {
        RAW: (table) =>
          and(buildFilterConditions(table), buildKeysetCondition(table))!,
      },
      with: reviewAssignmentWithConfig,
      // The `leastReviewed` cursor carries all four sort keys, and three of
      // them are computed — so they have to come back with the row. Emitted as
      // cheap constants for the date sorts, which don't read them, rather than
      // made conditional (that would widen the row type to `| undefined`).
      extras: {
        completedReviewCount: (table, { sql: sqlOp }) =>
          sort === 'leastReviewed'
            ? sqlOp<number>`${completedReviewCount(table)}`.as(
                'completed_review_count',
              )
            : sqlOp<number>`0`.as('completed_review_count'),
        statusRank: (table, { sql: sqlOp }) =>
          sort === 'leastReviewed'
            ? sqlOp<number>`${statusRank(table)}`.as('status_rank')
            : sqlOp<number>`0`.as('status_rank'),
        reviewerShuffle: (table, { sql: sqlOp }) =>
          sort === 'leastReviewed'
            ? sqlOp<string>`${reviewerShuffle(table)}`.as('reviewer_shuffle')
            : sqlOp<string>`''`.as('reviewer_shuffle'),
      },
      // One extra row tells us whether a next page exists.
      limit: limit + 1,
      // The `id` tie-break gives a deterministic order when the primary keys
      // are equal (e.g. same `assignedAt`, or same coverage before the
      // shuffle) — without it, rows sharing a sort value are skipped or
      // repeated at a page boundary.
      orderBy: (table, { asc, desc }) => {
        // `assignedAt` is nullable, and Postgres puts NULLs first on DESC —
        // which would let an undated assignment lead the "newest" list (the
        // single-proposal resolver reads the first row as the latest one).
        // NULLS LAST on both directions keeps an undated assignment from ever
        // winning.
        if (sort === 'newest') {
          return [sql`${table.assignedAt} DESC NULLS LAST`, desc(table.id)];
        }
        if (sort === 'oldest') {
          return [sql`${table.assignedAt} ASC NULLS LAST`, asc(table.id)];
        }
        // 'leastReviewed': fewest completed reviews, then status priority, then
        // the stable per-reviewer shuffle.
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

  const lastRow = assignments[assignments.length - 1];
  let next: string | null = null;
  if (hasMore && lastRow) {
    next =
      sort === 'leastReviewed'
        ? encodeCursor<z.infer<typeof coverageCursorSchema>>({
            completedReviewCount: lastRow.completedReviewCount,
            statusRank: lastRow.statusRank,
            reviewerShuffle: lastRow.reviewerShuffle,
            id: lastRow.id,
          })
        : encodeCursor<z.infer<typeof dateCursorSchema>>({
            assignedAt: lastRow.assignedAt,
            id: lastRow.id,
          });
  }

  return reviewAssignmentListSchema.parse({
    assignments: assignmentList,
    next,
    total,
  });
}

/**
 * Base64 JSON from an unknown source: reject a tampered or stale-shaped
 * payload here so the query never sees it, and the caller gets a 400 rather
 * than a SQL type error.
 */
function parseCursor<TSchema extends z.ZodType>(
  cursor: string,
  schema: TSchema,
): z.output<TSchema> {
  let decoded: unknown;
  try {
    decoded = decodeCursor<unknown>(cursor);
  } catch {
    throw new ValidationError('Invalid cursor');
  }

  const result = schema.safeParse(decoded);
  if (!result.success) {
    throw new ValidationError('Invalid cursor');
  }
  return result.data;
}
