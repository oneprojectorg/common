import { pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { processInstances } from './processInstances.sql';
import { profiles } from './profiles.sql';

export const decisionsVoteDrafts = pgTable(
  'decisions_vote_drafts',
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
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    uniqueIndex('decisions_vote_drafts_instance_profile_uniq').on(
      table.processInstanceId,
      table.profileId,
    ),
  ],
);

export type DecisionsVoteDraft = typeof decisionsVoteDrafts.$inferSelect;
