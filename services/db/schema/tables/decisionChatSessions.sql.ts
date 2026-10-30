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

export const decisionChatSessions = pgTable(
  'decision_chat_sessions',
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
    phoneNumberId: uuid('phone_number_id').references(
      () => decisionPhoneNumbers.id,
      {
        onUpdate: 'cascade',
        onDelete: 'set null',
      },
    ),
    pageCursor: integer('page_cursor'),
    reopenedAt: timestamp('reopened_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    uniqueIndex('decision_chat_sessions_instance_profile_uniq').on(
      table.processInstanceId,
      table.profileId,
    ),
  ],
);

export type DecisionChatSession = typeof decisionChatSessions.$inferSelect;
