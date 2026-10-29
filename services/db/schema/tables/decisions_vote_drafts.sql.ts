import {
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { decisionPhoneNumbers } from './decisionPhoneNumbers.sql';
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
    pageCursor: integer('page_cursor'),
    chatLineId: uuid('chat_line_id').references(() => decisionPhoneNumbers.id, {
      onUpdate: 'cascade',
      onDelete: 'set null',
    }),
    reopenedAt: timestamp('reopened_at', { withTimezone: true }),
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
