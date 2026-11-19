/**
 * The facet shape every answer-filtered read returns, defined once.
 *
 * Both the admin phase list and the reviewer queue count the same jsonb
 * answers against the same rubric catalogue, so they publish the same facet
 * contract — one definition, so a client can render either from one
 * component.
 */
import { z } from 'zod';

/**
 * `criterionKey -> option ids`. ANY-OF within a key, AND across keys. Keys
 * the rubric does not offer as a choice criterion are ignored (and logged),
 * so a stale client filter widens the result set rather than failing.
 */
export const templateFieldFiltersSchema = z.record(
  z.string(),
  z.array(z.string()),
);

export type TemplateFieldFilters = z.infer<typeof templateFieldFiltersSchema>;

/**
 * Counts for one choice criterion, over the set filtered by every *other*
 * key. Every option the rubric declares is present, including the ones no
 * review chose — a filter you cannot select is worse than one that returns
 * nothing.
 */
export const templateFieldFacetSchema = z.object({
  key: z.string(),
  kind: z.enum(['single', 'multi']),
  options: z.array(
    z.object({
      id: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
});

export type TemplateFieldFacet = z.infer<typeof templateFieldFacetSchema>;

/** A facet read on its own: the counts plus the size of the filtered set. */
export const templateFieldFacetsSchema = z.object({
  /** Rows matching every filter — the number the result count shows. */
  total: z.number().int().nonnegative(),
  facets: z.array(templateFieldFacetSchema),
});

export type TemplateFieldFacets = z.infer<typeof templateFieldFacetsSchema>;
