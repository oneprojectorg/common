/**
 * The reviewer queue's access check and WHERE builder, shared by the page
 * read and the facet read.
 *
 * Extracted so the two cannot drift: a facet count taken over a slightly
 * different population than the list it labels is worse than no count. Every
 * predicate that decides which assignments a reviewer may see lives here and
 * nowhere else.
 */
import { type SQL, and, db, eq, exists, inArray, sql } from '@op/db/client';
import {
  type ProposalReviewAssignmentStatus,
  proposalReviewAssignments,
  proposalReviews,
  proposals,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { CommonError, UnauthorizedError } from '../../utils';
import { assertProfileAccess, assertUserByAuthId } from '../assert';
import { resolvePhaseRubricTemplate } from '../formSchemas';
import {
  type ChoiceCriterion,
  choiceFilters,
  extractChoiceCriteria,
} from '../templateValues';
import { getInstance } from './getInstance';
import { decisionPermission } from './permissions';
import { notSuperseded } from './proposalSupersession';
import { assertInstancePhase } from './utils/instance';
import {
  REVIEW_ANSWERS_EXPR,
  type ReviewAnswerFilters,
  resolveReviewAnswerFilters,
} from './utils/reviewAnswers';

/** Everything both queue reads filter on. Pagination and sort are not here. */
export interface ReviewQueueScopeInput {
  processInstanceId: string;
  phaseId: string;
  status?: ProposalReviewAssignmentStatus;
  /** Taxonomy term ids — limits results to assignments whose proposal is in any of the categories. */
  categoryIds?: string[];
  /** Profile id of a single proposal — limits results to that proposal's assignments. */
  proposalProfileId?: string;
  /** Answer filters on the assignment's own review. */
  fieldFilters?: ReviewAnswerFilters;
}

export interface QueueWhereOptions {
  /**
   * Replaces the built-in answer-filter predicate: a `SQL` to use instead, or
   * `null` for no answer filter at all. Omit to get the request's own
   * filters, which is what the list wants.
   *
   * The facet branches need both: `null` would count the wrong population,
   * and the built-in predicate would count each key against its own filter.
   */
  answerFilter?: SQL | null;
}

export interface ReviewQueueScope {
  instance: Awaited<ReturnType<typeof getInstance>>;
  reviewerProfileId: string;
  /** The phase rubric's choice criteria — the facet catalogue and the filter allow-list. */
  fieldCriteria: ChoiceCriterion[];
  /** The requested filters, minus keys and options the rubric does not declare. */
  activeFieldFilters: ReviewAnswerFilters;
  /** True when the scope cannot match any assignment; callers return empty. */
  isEmpty: boolean;
  /**
   * The full WHERE clause for the queue.
   *
   * Parameterized on the table reference so the same builder serves the v2
   * relational `findMany` (which passes an aliased table) and a plain
   * `db.select().from(...)` count.
   */
  buildWhereClause: (
    assignmentsTable: typeof proposalReviewAssignments,
    options?: QueueWhereOptions,
  ) => SQL;
  /**
   * The answer-filter predicate on its own, over a caller-supplied answers
   * expression.
   *
   * `exceptKey` drops one criterion's filter, which is what makes a facet
   * count describe "what would happen if I changed this one filter".
   */
  buildAnswerFilter: (options?: {
    expr?: SQL;
    exceptKey?: string;
  }) => SQL | undefined;
}

/**
 * Resolves the reviewer's authorized queue scope in `phaseId`.
 *
 * Throws exactly what the queue read threw before this was extracted:
 * `UnauthorizedError` without a profile or the REVIEW/ADMIN capability,
 * `NotFoundError` for an unknown phase.
 */
export async function resolveReviewQueueScope({
  input,
  user,
}: {
  input: ReviewQueueScopeInput;
  user: User;
}): Promise<ReviewQueueScope> {
  const { processInstanceId, phaseId, status, categoryIds, proposalProfileId } =
    input;

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
  // match any assignment, so the scope is empty.
  let categoryProposalIds: string[] | undefined;
  let categoryIsEmpty = false;
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
    categoryIsEmpty = categoryProposalIds.length === 0;
  }

  // The rubric of the phase the assignments belong to. Answers are only ever
  // interpreted against their own phase's rubric, so this is both the filter
  // allow-list and the facet catalogue.
  const rubricTemplate = await resolvePhaseRubricTemplate(
    instance.instanceData,
    phaseId,
  );
  const fieldCriteria = extractChoiceCriteria(rubricTemplate);

  const activeFieldFilters = resolveReviewAnswerFilters({
    filters: input.fieldFilters,
    criteria: fieldCriteria,
    context: {
      read: 'reviewQueue',
      processInstanceId,
      phaseId,
      reviewerProfileId,
    },
  });

  const buildAnswerFilter = (options?: {
    expr?: SQL;
    exceptKey?: string;
  }): SQL | undefined =>
    choiceFilters({
      expr: options?.expr ?? REVIEW_ANSWERS_EXPR,
      criteria: fieldCriteria,
      filters: activeFieldFilters,
      exceptKey: options?.exceptKey,
    });

  /**
   * "This assignment's own review matches every answer filter."
   *
   * Written as a semi-join rather than a correlated `EXISTS` so the planner
   * keeps both options: the unique index on `assignment_id` for a small
   * reviewer scope, or `proposal_reviews_answers_gin` when the containment is
   * the selective half. `assignment_id` is UNIQUE, so "some review of this
   * assignment matches" and "its review matches" are the same statement.
   *
   * An assignment with no review row can never satisfy it — an unanswered
   * assignment is not a match for an answer filter, which is the same rule a
   * LEFT JOIN plus a WHERE on the joined side gives.
   */
  const listAnswerFilterCondition = (
    t: typeof proposalReviewAssignments,
  ): SQL | undefined => {
    const containment = buildAnswerFilter();
    if (!containment) {
      return undefined;
    }

    return inArray(
      t.id,
      db
        .select({ assignmentId: proposalReviews.assignmentId })
        .from(proposalReviews)
        .where(containment),
    );
  };

  const buildWhereClause = (
    t: typeof proposalReviewAssignments,
    options?: QueueWhereOptions,
  ): SQL => {
    const answerFilter =
      options && 'answerFilter' in options
        ? (options.answerFilter ?? undefined)
        : listAnswerFilterCondition(t);

    return and(
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
      answerFilter,
      // Merging doesn't delete assignments, so a proposal merged mid-review
      // would otherwise stay in its reviewer's queue.
      notSuperseded({ proposalId: t.proposalId, processInstanceId }),
    )!;
  };

  return {
    instance,
    reviewerProfileId,
    fieldCriteria,
    activeFieldFilters,
    isEmpty: categoryIsEmpty,
    buildWhereClause,
    buildAnswerFilter,
  };
}

/**
 * Builds the row set a facet branch counts over: one row per assignment in
 * the queue, carrying the answers of its own review.
 *
 * A LEFT JOIN with a `'{}'` fallback, so an assignment with no review still
 * belongs to the population and simply lands in no option bucket — the same
 * rows the unfiltered list shows.
 *
 * `extraWhere` is the branch's "every other key" predicate, applied directly
 * to the joined review row rather than through the list's semi-join: the
 * table is already joined here, so a nested subquery would only hide
 * `proposal_reviews_answers_gin` from the planner.
 */
export function buildReviewQueueFacetScope(
  scope: ReviewQueueScope,
): (extraWhere: SQL | undefined) => SQL {
  const queueWhere = scope.buildWhereClause(proposalReviewAssignments, {
    answerFilter: null,
  });

  return (extraWhere) =>
    sql`(${db
      .select({
        answers: sql`COALESCE(${REVIEW_ANSWERS_EXPR}, '{}'::jsonb)`.as(
          'answers',
        ),
      })
      .from(proposalReviewAssignments)
      .leftJoin(
        proposalReviews,
        eq(proposalReviews.assignmentId, proposalReviewAssignments.id),
      )
      .where(and(queueWhere, extraWhere))})`;
}
