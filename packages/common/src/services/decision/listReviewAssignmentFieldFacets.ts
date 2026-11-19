import { count as countFn, db } from '@op/db/client';
import {
  type ProposalReviewAssignmentStatus,
  proposalReviewAssignments,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import {
  type FacetCountRow,
  facetCountsQuery,
  zipFacetCounts,
} from '../templateValues';
import {
  buildReviewQueueFacetScope,
  resolveReviewQueueScope,
} from './reviewQueueScope';
import {
  type TemplateFieldFacets,
  templateFieldFacetsSchema,
} from './schemas/templateFieldFacets';
import {
  REVIEW_ANSWERS_EXPR,
  type ReviewAnswerFilters,
} from './utils/reviewAnswers';

/**
 * Facet counts for the reviewer's own queue in `phaseId`, plus the size of
 * the filtered set.
 *
 * A separate read from the page rather than a field on it: the filter panel
 * needs the counts on every page, and a facet count is not a function of the
 * page. Both reads resolve the same scope through
 * `resolveReviewQueueScope`, so these numbers always label exactly the rows
 * the queue list returns.
 */
export async function listReviewAssignmentFieldFacets({
  processInstanceId,
  phaseId,
  status,
  categoryIds,
  proposalProfileId,
  fieldFilters,
  user,
}: {
  processInstanceId: string;
  phaseId: string;
  status?: ProposalReviewAssignmentStatus;
  /** Taxonomy term ids — limits results to assignments whose proposal is in any of the categories. */
  categoryIds?: string[];
  /** Profile id of a single proposal — limits results to that proposal's assignments. */
  proposalProfileId?: string;
  /** The filters currently applied; each key's counts ignore its own. */
  fieldFilters?: ReviewAnswerFilters;
  user: User;
}): Promise<TemplateFieldFacets> {
  const scope = await resolveReviewQueueScope({
    input: {
      processInstanceId,
      phaseId,
      status,
      categoryIds,
      proposalProfileId,
      fieldFilters,
    },
    user,
  });

  const { fieldCriteria, activeFieldFilters } = scope;

  // An empty scope still owes the panel its catalogue — with no rows,
  // `zipFacetCounts` returns every option at zero.
  if (scope.isEmpty) {
    return templateFieldFacetsSchema.parse({
      total: 0,
      facets: zipFacetCounts({ criteria: fieldCriteria }),
    });
  }

  // `total` carries every filter, answer filters included — it is the result
  // count the list shows, not a facet denominator.
  const totalQuery = db
    .select({ count: countFn() })
    .from(proposalReviewAssignments)
    .where(scope.buildWhereClause(proposalReviewAssignments));

  const facetQuery = facetCountsQuery({
    criteria: fieldCriteria,
    filters: activeFieldFilters,
    // Inside a facet branch the review row is already joined, so the branch
    // filters it directly on the indexed expression — the list's semi-join
    // would only hide `proposal_reviews_answers_gin` from the planner here.
    expr: REVIEW_ANSWERS_EXPR,
    scopeSubquery: buildReviewQueueFacetScope(scope),
  });

  const [totalRows, facetRows] = await Promise.all([
    totalQuery,
    facetQuery
      ? db.execute<FacetCountRow>(facetQuery)
      : Promise.resolve<FacetCountRow[]>([]),
  ]);

  return templateFieldFacetsSchema.parse({
    total: Number(totalRows[0]?.count ?? 0),
    facets: zipFacetCounts({
      criteria: fieldCriteria,
      facetRows: [...facetRows],
    }),
  });
}
