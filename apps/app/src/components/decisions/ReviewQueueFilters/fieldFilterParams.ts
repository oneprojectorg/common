/**
 * The filter sheet's state, carried in one search param so a narrowed queue is
 * a link someone can paste to a colleague:
 * `?fields=__overall_recommendation:yes,maybe;department:public-safety`.
 *
 * One param per criterion would read better, but nuqs binds a hook per param
 * key and the criterion set only exists at runtime — a hook per rubric
 * criterion is not a fixed hook list.
 */

/** `criterionKey -> option ids`, the shape the queue procedure takes. */
export type FieldFilters = Record<string, string[]>;

/**
 * One criterion's counts, as the facet read returns them.
 *
 * Declared structurally rather than imported: it mirrors
 * `templateFieldFacetSchema`
 * (`packages/common/src/services/decision/schemas/templateFieldFacets.ts`),
 * which `@op/common/client` does not re-export yet.
 */
export interface FieldFacet {
  key: string;
  kind: 'single' | 'multi';
  options: Array<{ id: string; count: number }>;
}

/** `criterionKey -> optionId -> count`, the lookup the sheet renders from. */
export function indexFacetCounts(
  facets: readonly FieldFacet[],
): Map<string, Map<string, number>> {
  return new Map(
    facets.map((facet) => [
      facet.key,
      new Map(facet.options.map((option) => [option.id, option.count])),
    ]),
  );
}

/** The search param the sheet owns. */
export const FIELD_FILTERS_PARAM = 'fields';

const CRITERION_SEPARATOR = ';';
const KEY_SEPARATOR = ':';
const OPTION_SEPARATOR = ',';

/**
 * Decodes the param. Malformed segments are skipped rather than rejected: the
 * URL is user-editable, and the procedure drops keys and options the rubric
 * does not offer anyway.
 */
export function parseFieldFilters(raw: string | null): FieldFilters {
  if (!raw) {
    return {};
  }

  const filters: FieldFilters = {};
  for (const segment of raw.split(CRITERION_SEPARATOR)) {
    const separatorIndex = segment.indexOf(KEY_SEPARATOR);
    if (separatorIndex <= 0) {
      continue;
    }
    const key = segment.slice(0, separatorIndex);
    const optionIds = segment
      .slice(separatorIndex + 1)
      .split(OPTION_SEPARATOR)
      .filter((optionId) => optionId.length > 0);
    if (optionIds.length === 0) {
      continue;
    }
    // De-duplicated so a hand-edited URL cannot make one option toggle twice.
    filters[key] = [...new Set(optionIds)];
  }

  return filters;
}

/** Encodes the param. `null` clears it, which is how nuqs drops a key. */
export function serializeFieldFilters(filters: FieldFilters): string | null {
  const segments = Object.entries(filters)
    .filter(([, optionIds]) => optionIds.length > 0)
    .map(
      ([key, optionIds]) =>
        `${key}${KEY_SEPARATOR}${optionIds.join(OPTION_SEPARATOR)}`,
    );

  return segments.length > 0 ? segments.join(CRITERION_SEPARATOR) : null;
}

/** Adds or removes one option, dropping the key when it empties. */
export function toggleFieldFilter(
  filters: FieldFilters,
  key: string,
  optionId: string,
): FieldFilters {
  const current = filters[key] ?? [];
  const next = current.includes(optionId)
    ? current.filter((id) => id !== optionId)
    : [...current, optionId];

  const updated: FieldFilters = { ...filters };
  if (next.length > 0) {
    updated[key] = next;
  } else {
    delete updated[key];
  }
  return updated;
}

/** How many options are checked across every criterion. */
export function countFieldFilters(filters: FieldFilters): number {
  return Object.values(filters).reduce(
    (total, optionIds) => total + optionIds.length,
    0,
  );
}

/**
 * `undefined` for an empty selection, so the query key of an unfiltered queue
 * is the one it had before the sheet existed.
 */
export function toQueryInput(filters: FieldFilters): FieldFilters | undefined {
  return Object.keys(filters).length > 0 ? filters : undefined;
}
