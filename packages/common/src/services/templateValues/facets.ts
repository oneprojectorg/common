/**
 * Turning facet count rows into the facet list a filter panel renders.
 *
 * The only step of faceting that is not SQL, and it exists for one reason:
 * SQL knows the options some answer actually chose, while the template knows
 * every option that *could* be chosen, and in what order. A filter panel
 * needs the second — an option nobody picked still has to be selectable, next
 * to a zero.
 */
import type { ChoiceCriterion } from './criteria';
import type { FacetCountRow } from './sql';

/** One criterion's counts, catalogue-complete and in template order. */
export interface TemplateFacet {
  key: string;
  kind: ChoiceCriterion['kind'];
  options: Array<{ id: string; count: number }>;
}

/**
 * Zips SQL counts onto the template's option catalogue.
 *
 * Two kinds of row are dropped: the `null` bucket, which counts answers that
 * left the criterion blank, and any option the template no longer declares —
 * an option deleted after answers referencing it were stored. Passing no rows
 * yields every option at zero, which is what an empty scope returns.
 */
export function zipFacetCounts({
  criteria,
  facetRows,
}: {
  criteria: readonly ChoiceCriterion[];
  facetRows?: readonly FacetCountRow[];
}): TemplateFacet[] {
  const counts = new Map<string, number>();
  for (const row of facetRows ?? []) {
    if (row.option_id === null) {
      continue;
    }
    counts.set(
      facetBucketKey(row.facet_key, row.option_id),
      Number(row.option_count),
    );
  }

  return criteria.map((criterion) => ({
    key: criterion.key,
    kind: criterion.kind,
    options: criterion.optionIds.map((optionId) => ({
      id: optionId,
      count: counts.get(facetBucketKey(criterion.key, optionId)) ?? 0,
    })),
  }));
}

/**
 * A criterion key and an option id are both free-form strings, so they are
 * joined by a character neither can contain — a newline — rather than a colon
 * or a space, which an option label may well include.
 */
function facetBucketKey(criterionKey: string, optionId: string): string {
  return `${criterionKey}\n${optionId}`;
}
