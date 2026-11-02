import { pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { processInstances } from './processInstances.sql';
import { profiles } from './profiles.sql';
import { taxonomyTerms } from './taxonomies.sql';

export const decisionVoterEnrolments = pgTable(
  'decision_voter_enrolments',
  {
    id: autoId().primaryKey(),
    processInstanceId: uuid('process_instance_id')
      .notNull()
      .references(() => processInstances.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),
    taxonomyTermId: uuid('taxonomy_term_id').references(
      () => taxonomyTerms.id,
      {
        onUpdate: 'cascade',
        onDelete: 'set null',
      },
    ),
    enrolledAt: timestamp('enrolled_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    uniqueIndex('decision_voter_enrolments_instance_profile_uniq').on(
      table.processInstanceId,
      table.profileId,
    ),
  ],
);

export type DecisionVoterEnrolment =
  typeof decisionVoterEnrolments.$inferSelect;
