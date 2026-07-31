import { sql } from 'drizzle-orm';
import {
  index,
  pgTable,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { processInstances } from './processInstances.sql';
import { profiles } from './profiles.sql';
import { taxonomyTerms } from './taxonomies.sql';

/**
 * Scope layer for reviews-by-category: which reviewer profile covers which
 * submission category in a process instance (optionally scoped to a phase).
 *
 * Keyed on `taxonomyTermId` (append-only in prod) rather than a config-local
 * category id, so it stays cross-instance-safe. `reviewerProfileId` FKs to the
 * profile, not a role — REVIEW is a computed union (see
 * `getEligibleReviewerProfileIds`), so dangling scope rows are tolerated.
 */
export const categoryReviewers = pgTable(
  'decision_category_reviewers',
  {
    id: autoId().primaryKey(),

    processInstanceId: uuid('process_instance_id')
      .notNull()
      .references(() => processInstances.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    taxonomyTermId: uuid('taxonomy_term_id')
      .notNull()
      .references(() => taxonomyTerms.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    reviewerProfileId: uuid('reviewer_profile_id')
      .notNull()
      .references(() => profiles.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    // NULL = instance-wide; set = phase-specific (matches proposalReviewAssignments).
    phaseId: varchar('phase_id', { length: 256 }),

    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    // COALESCE to '' so instance-wide (NULL phaseId) rows collide instead of
    // each NULL being treated as distinct.
    uniqueIndex('category_reviewers_unique').on(
      table.processInstanceId,
      table.taxonomyTermId,
      table.reviewerProfileId,
      sql`COALESCE(${table.phaseId}, '')`,
    ),
    // Supports "who does this reviewer cover in this instance" lookups.
    index('category_reviewers_process_reviewer_idx').on(
      table.processInstanceId,
      table.reviewerProfileId,
    ),
  ],
);

export type CategoryReviewer = typeof categoryReviewers.$inferSelect;
