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
import { profiles } from './profiles.sql';
import { taxonomyTerms } from './taxonomies.sql';

/**
 * Named geographic boundaries (e.g. council districts) imported from GeoJSON,
 * scoped per decision profile (`profileId` → `processInstances.profileId`) so a
 * picker only ever sees the overlay and in-area validation for the decision the
 * participant is composing in.
 *
 * Each boundary is linked to a proposal category (`taxonomyTermId`) by name, so
 * a proposal whose location falls inside the boundary is auto-tagged with that
 * category (see `boundaryCategory` / `resolveBoundary`). The polygon is matched
 * against a proposal's pin via `ST_Contains`.
 */
export const decisionBoundaries = pgTable(
  'decision_boundaries',
  {
    id: autoId().primaryKey(),
    // Decision profile that owns this boundary — the same `profileId` carried
    // by `processInstances`. Re-imports are scoped to this profile so two
    // decisions can each have their own "District 7" without colliding.
    // Nullable for now so pre-existing deployment-global rows survive the
    // column add; a follow-up migration backfills and flips it `NOT NULL`.
    profileId: uuid('profile_id').references(() => profiles.id, {
      onUpdate: 'cascade',
      onDelete: 'cascade',
    }),
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
    // One boundary per name (case-insensitive) within a profile, so re-import
    // is idempotent per scope and two profiles can share boundary names.
    uniqueIndex('decision_boundaries_profile_id_name_unique').on(
      table.profileId,
      sql`lower(${table.name})`,
    ),
    index('decision_boundaries_profile_id_index').on(table.profileId),
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
