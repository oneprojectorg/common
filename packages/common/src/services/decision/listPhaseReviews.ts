import {
  type SQL,
  aliasedTable,
  and,
  count as countFn,
  db,
  desc,
  eq,
  isNull,
  sql,
} from '@op/db/client';
import {
  ProposalReviewState,
  profiles,
  proposalReviewAssignments,
  proposalReviews,
  proposals,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';
import { z } from 'zod';

import {
  PAGE_LIMIT,
  UnauthorizedError,
  ValidationError,
  decodeCursor,
  encodeCursor,
} from '../../utils';
import { assertProfileAccess } from '../assert';
import { resolvePhaseRubricTemplate } from '../formSchemas';
import {
  type FacetCountRow,
  choiceFilters,
  descendingTimestampKey,
  descendingTimestampKeyset,
  extractChoiceCriteria,
  facetCountsQuery,
  zipFacetCounts,
} from '../templateValues';
import { getInstance } from './getInstance';
import {
  type PhaseReviewFilters,
  type PhaseReviewList,
  type PhaseReviewStateFilter,
  phaseReviewListSchema,
} from './schemas/phaseReviews';
import { assertInstancePhase } from './utils/instance';
import {
  REVIEW_ANSWERS_EXPR,
  resolveReviewAnswerFilters,
} from './utils/reviewAnswers';

/** Keyset position: the sort keys of the last row served. */
const phaseReviewCursorSchema = z.object({
  submittedAt: z.string().nullable(),
  id: z.uuid(),
});

type PhaseReviewCursor = z.infer<typeof phaseReviewCursorSchema>;

/**
 * One page of the reviews recorded in `phaseId`, with a facet count for every
 * choice option the phase's rubric offers.
 *
 * Admin-only on the instance profile: this is a cross-reviewer read, so it
 * carries no reviewer scoping of its own.
 */
export async function listPhaseReviews({
  processInstanceId,
  phaseId,
  filters,
  state = 'submitted',
  cursor,
  limit = PAGE_LIMIT.lg,
  user,
}: {
  processInstanceId: string;
  phaseId: string;
  filters?: PhaseReviewFilters;
  state?: PhaseReviewStateFilter;
  cursor?: string | null;
  limit?: number;
  user: User;
}): Promise<PhaseReviewList> {
  const instance = await getInstance({ instanceId: processInstanceId, user });

  if (!instance.profileId) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  // No org fallback by design (see `listPhaseReviewerSummaries`): the grant
  // that admits this read is the one held on the decision's own profile.
  await assertProfileAccess({
    user,
    profileId: instance.profileId,
    permissions: { decisions: permission.ADMIN },
  });

  assertInstancePhase({ instance, phaseId });

  // The rubric of the phase the reviews belong to — reviews are only ever
  // interpreted against their own phase's rubric. Prefers the `form_schemas`
  // head, falling back to the inline copy.
  const rubricTemplate = await resolvePhaseRubricTemplate(
    instance.instanceData,
    phaseId,
  );
  const criteria = extractChoiceCriteria(rubricTemplate);

  const activeFilters = resolveReviewAnswerFilters({
    filters,
    criteria,
    context: { read: 'listPhaseReviews', processInstanceId, phaseId },
  });

  const decodedCursor = decodePhaseReviewCursor(cursor);

  const proposalProfiles = aliasedTable(profiles, 'proposal_profiles');
  const reviewerProfiles = aliasedTable(profiles, 'reviewer_profiles');

  // Shared by the page, the total and every facet branch, so all three
  // describe the same population.
  const scopeWhere = and(
    eq(proposalReviewAssignments.processInstanceId, processInstanceId),
    eq(proposalReviewAssignments.phaseId, phaseId),
    reviewStateCondition(state),
    // Same visibility scoping as `listPhaseReviewAssignments`: a detached or
    // deleted proposal is unreachable even to admins, and an assignment made
    // before the verdict would otherwise leak it back.
    isNull(proposals.deletedAt),
    isNull(proposals.moderationDetachedAt),
  );

  const filterWhere = choiceFilters({
    expr: REVIEW_ANSWERS_EXPR,
    criteria,
    filters: activeFilters,
  });

  const sortKey = descendingTimestampKey(proposalReviews.submittedAt);

  /**
   * The page, resolved in two steps.
   *
   * The keyset page is taken over the narrow review/assignment/proposal join
   * first, and the display names are joined onto the 26 ids that survive.
   * Written as one query it seq-scanned all 46k `profiles` for both
   * `LEFT JOIN profiles` legs — the planner hashes the whole table rather
   * than believing the `LIMIT`, and the two legs showed up as
   * `Seq Scan on profiles` in most measured plans. Joining after the limit
   * turns them into 26 primary-key lookups.
   *
   * `proposals` is joined in both halves on purpose: the inner half needs its
   * soft-delete and moderation columns for the scope, and pulling the 2.4 kB
   * `proposal_data` through the sort to reach the title fallback would cost
   * more than re-reading 26 rows by primary key.
   */
  const pageKeyset = db
    .select({
      reviewId: proposalReviews.id,
      assignmentId: proposalReviews.assignmentId,
      submittedAt: proposalReviews.submittedAt,
      proposalId: proposalReviewAssignments.proposalId,
      reviewerProfileId: proposalReviewAssignments.reviewerProfileId,
      answers: sql<
        Record<string, unknown>
      >`COALESCE(${REVIEW_ANSWERS_EXPR}, '{}'::jsonb)`.as('answers'),
      // The ORDER BY key, carried out so the outer query can re-apply it: a
      // join does not preserve the subquery's order.
      sortKey: sql<string>`${sortKey}`.as('sort_key'),
    })
    .from(proposalReviews)
    .innerJoin(
      proposalReviewAssignments,
      eq(proposalReviewAssignments.id, proposalReviews.assignmentId),
    )
    .innerJoin(
      proposals,
      eq(proposals.id, proposalReviewAssignments.proposalId),
    )
    .where(
      and(
        scopeWhere,
        filterWhere,
        // The cursor belongs to the page only — `total` stays the full count.
        decodedCursor
          ? descendingTimestampKeyset({
              keyExpr: sortKey,
              idColumn: proposalReviews.id,
              cursorTimestamp: decodedCursor.submittedAt,
              cursorId: decodedCursor.id,
            })
          : undefined,
      ),
    )
    .orderBy(desc(sortKey), desc(proposalReviews.id))
    .limit(limit + 1)
    .as('page');

  const pageQuery = db
    .select({
      reviewId: pageKeyset.reviewId,
      assignmentId: pageKeyset.assignmentId,
      submittedAt: pageKeyset.submittedAt,
      proposalId: pageKeyset.proposalId,
      reviewerProfileId: pageKeyset.reviewerProfileId,
      reviewerName: reviewerProfiles.name,
      // Edits write the title to the proposal's profile; the snapshot title
      // is the legacy fallback.
      proposalTitle: sql<
        string | null
      >`COALESCE(${proposalProfiles.name}, ${proposals.proposalData} ->> 'title')`.as(
        'proposal_title',
      ),
      answers: pageKeyset.answers,
    })
    .from(pageKeyset)
    .innerJoin(proposals, eq(proposals.id, pageKeyset.proposalId))
    .leftJoin(proposalProfiles, eq(proposalProfiles.id, proposals.profileId))
    .leftJoin(
      reviewerProfiles,
      eq(reviewerProfiles.id, pageKeyset.reviewerProfileId),
    )
    .orderBy(desc(pageKeyset.sortKey), desc(pageKeyset.reviewId));

  const totalQuery = db
    .select({ count: countFn() })
    .from(proposalReviews)
    .innerJoin(
      proposalReviewAssignments,
      eq(proposalReviewAssignments.id, proposalReviews.assignmentId),
    )
    .innerJoin(
      proposals,
      eq(proposals.id, proposalReviewAssignments.proposalId),
    )
    .where(and(scopeWhere, filterWhere));

  // The row set a facet branch counts over. Kept as a subquery (rather than a
  // materialized CTE shared by the branches) so each branch's containment
  // predicates stay in a WHERE the GIN index can serve. With no active filter
  // there is exactly one branch, so exactly one scan.
  const facetScope = (extraWhere: SQL | undefined): SQL =>
    sql`(${db
      .select({
        answers: sql`${REVIEW_ANSWERS_EXPR}`.as('answers'),
      })
      .from(proposalReviews)
      .innerJoin(
        proposalReviewAssignments,
        eq(proposalReviewAssignments.id, proposalReviews.assignmentId),
      )
      .innerJoin(
        proposals,
        eq(proposals.id, proposalReviewAssignments.proposalId),
      )
      .where(and(scopeWhere, extraWhere))})`;

  const facetQuery = facetCountsQuery({
    criteria,
    filters: activeFilters,
    expr: REVIEW_ANSWERS_EXPR,
    scopeSubquery: facetScope,
  });

  const [rows, totalRows, facetRows] = await Promise.all([
    pageQuery,
    totalQuery,
    facetQuery
      ? db.execute<FacetCountRow>(facetQuery)
      : Promise.resolve<FacetCountRow[]>([]),
  ]);

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const lastRow = pageRows[pageRows.length - 1];

  return phaseReviewListSchema.parse({
    items: pageRows.map((row) => ({
      reviewId: row.reviewId,
      assignmentId: row.assignmentId,
      proposalId: row.proposalId,
      proposalTitle: row.proposalTitle,
      reviewerProfileId: row.reviewerProfileId,
      reviewerName: row.reviewerName,
      submittedAt: row.submittedAt,
      answers: row.answers,
    })),
    total: Number(totalRows[0]?.count ?? 0),
    facets: zipFacetCounts({ criteria, facetRows: [...facetRows] }),
    nextCursor:
      hasMore && lastRow
        ? encodeCursor<PhaseReviewCursor>({
            submittedAt: lastRow.submittedAt,
            id: lastRow.reviewId,
          })
        : null,
  });
}

/** `undefined` for `'all'` — the state column is then simply not constrained. */
function reviewStateCondition(state: PhaseReviewStateFilter): SQL | undefined {
  if (state === 'submitted') {
    return eq(proposalReviews.state, ProposalReviewState.SUBMITTED);
  }
  if (state === 'draft') {
    return eq(proposalReviews.state, ProposalReviewState.DRAFT);
  }
  return undefined;
}

function decodePhaseReviewCursor(
  cursor?: string | null,
): PhaseReviewCursor | undefined {
  if (!cursor) {
    return undefined;
  }

  // `decodeCursor` raises a bare CommonError (500) on unreadable base64/JSON,
  // and its generic is an unchecked cast. Funnelling both failure modes into
  // the schema check keeps every bad cursor a 400 with one message.
  const decoded = ((): unknown => {
    try {
      return decodeCursor<unknown>(cursor);
    } catch {
      return undefined;
    }
  })();

  const result = phaseReviewCursorSchema.safeParse(decoded);
  if (!result.success) {
    throw new ValidationError('Invalid cursor');
  }

  return result.data;
}
