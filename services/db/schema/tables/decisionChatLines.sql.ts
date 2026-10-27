import { sql } from 'drizzle-orm';
import {
  check,
  pgTable,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { processInstances } from './processInstances.sql';

export const decisionChatLines = pgTable(
  'decision_chat_lines',
  {
    id: autoId().primaryKey(),
    processInstanceId: uuid('process_instance_id')
      .notNull()
      .references(() => processInstances.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),
    phoneNumber: varchar('phone_number', { length: 32 }).notNull(),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    uniqueIndex('decision_chat_lines_process_instance_id_uniq').on(
      table.processInstanceId,
    ),
    uniqueIndex('decision_chat_lines_phone_number_uniq').on(table.phoneNumber),
    check(
      'decision_chat_lines_phone_number_e164_chk',
      sql`${table.phoneNumber} ~ '^\\+[1-9][0-9]{1,14}$'`,
    ),
  ],
);

export type DecisionChatLine = typeof decisionChatLines.$inferSelect;
