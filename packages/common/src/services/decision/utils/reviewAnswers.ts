/**
 * The one definition of "a review's answers" as a SQL expression, plus the
 * filter sanitiser every caller of it shares.
 *
 * Both the admin phase list and the reviewer queue filter the same jsonb map,
 * and both must emit the *identical* expression or one of them loses the GIN
 * index (see `jsonbMemberExpr`). Defining it once is the only way to keep
 * that true.
 */
import { proposalReviews } from '@op/db/schema';
import { logger } from '@op/logging';

import {
  type ChoiceCriterion,
  indexChoiceCriteria,
  jsonbMemberExpr,
} from '../../templateValues';

/**
 * `review_data -> 'answers'` — the expression `proposal_reviews_answers_gin`
 * is declared on.
 */
export const REVIEW_ANSWERS_EXPR = jsonbMemberExpr(
  proposalReviews.reviewData,
  'answers',
);

/** `criterionKey -> option ids`. ANY-OF within a key, AND across keys. */
export type ReviewAnswerFilters = Record<string, string[]>;

/**
 * Drops filter keys the rubric does not offer as a choice criterion, and
 * options the criterion does not declare.
 *
 * Dropped rather than rejected: a rubric can be edited under a client still
 * holding an older filter panel, and widening the result set is a better
 * failure than a 400 on a stale bookmark. Logged so a filter that can never
 * match is visible instead of silent.
 */
export function resolveReviewAnswerFilters({
  filters,
  criteria,
  context,
}: {
  filters: ReviewAnswerFilters | undefined;
  criteria: readonly ChoiceCriterion[];
  /** Identifies the read in the warning — e.g. the caller name plus ids. */
  context: Record<string, unknown>;
}): ReviewAnswerFilters {
  if (!filters) {
    return {};
  }

  const byKey = indexChoiceCriteria(criteria);
  const active: ReviewAnswerFilters = {};
  const ignoredKeys: string[] = [];
  const ignoredOptions: string[] = [];

  for (const [key, optionIds] of Object.entries(filters)) {
    const criterion = byKey.get(key);
    if (!criterion) {
      ignoredKeys.push(key);
      continue;
    }
    if (optionIds.length === 0) {
      continue;
    }

    const declared = new Set(criterion.optionIds);
    const kept = optionIds.filter((optionId) => declared.has(optionId));
    for (const optionId of optionIds) {
      if (!declared.has(optionId)) {
        ignoredOptions.push(`${key}:${optionId}`);
      }
    }
    if (kept.length > 0) {
      active[key] = kept;
    }
  }

  if (ignoredKeys.length > 0 || ignoredOptions.length > 0) {
    logger.warn('Ignored review answer filters absent from the rubric', {
      ...context,
      ignoredKeys,
      ignoredOptions,
    });
  }

  return active;
}
