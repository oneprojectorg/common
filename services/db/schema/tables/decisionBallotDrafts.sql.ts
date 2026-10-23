import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { processInstances } from './processInstances.sql';
import { profiles } from './profiles.sql';

export const decisionBallotDrafts = pgTable(
  'decision_ballot_drafts',
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
    picks: jsonb('picks')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    pageCursor: integer('page_cursor'),
    reopenedAt: timestamp('reopened_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    uniqueIndex('decision_ballot_drafts_instance_profile_uniq').on(
      table.processInstanceId,
      table.profileId,
    ),
    check(
      'decision_ballot_drafts_picks_chk',
      sql`jsonb_typeof(${table.picks}) = 'array'`,
    ),
  ],
);

export type DecisionBallotDraft = typeof decisionBallotDrafts.$inferSelect;
