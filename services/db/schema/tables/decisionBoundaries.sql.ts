import { sql } from 'drizzle-orm';
import type { InferModel } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import {
  autoId,
  multiPolygon,
  serviceRolePolicies,
  timestamps,
} from '../../helpers';
import { taxonomyTerms } from './taxonomies.sql';

/**
 * Named geographic boundaries (e.g. council districts) imported from GeoJSON.
 *
 * Each boundary is linked to a proposal category (`taxonomyTermId`) by name, so
 * a proposal whose location falls inside the boundary is auto-tagged with that
 * category (see `boundaryCategory` / `resolveBoundary`). The polygon is matched
 * against a proposal's pin via `ST_Contains`.
 *
 * Deployment-global for now — boundaries are not yet scoped per client/org.
 */
export const decisionBoundaries = pgTable(
  'decision_boundaries',
  {
    id: autoId().primaryKey(),
    // Source name (from the chosen GeoJSON property); also the category match key.
    name: varchar('name', { length: 255 }).notNull(),
    // The linked proposal-taxonomy category. Set at import; cleared if the term
    // is deleted. Nullable to tolerate a boundary that has no matching category.
    taxonomyTermId: uuid('taxonomy_term_id').references(
      () => taxonomyTerms.id,
      {
        onUpdate: 'cascade',
        onDelete: 'set null',
      },
    ),
    boundary: multiPolygon('boundary').notNull(),
    metadata: jsonb('metadata'),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    // One boundary per name (case-insensitive), so re-import is idempotent.
    uniqueIndex('decision_boundaries_name_unique').on(
      sql`lower(${table.name})`,
    ),
    index('decision_boundaries_taxonomy_term_id_index').on(
      table.taxonomyTermId,
    ),
    index('decision_boundaries_boundary_gist_index').using(
      'gist',
      table.boundary,
    ),
  ],
);

export type DecisionBoundary = InferModel<typeof decisionBoundaries>;
