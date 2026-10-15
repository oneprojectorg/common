import { pgTable, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { processInstances } from './processInstances.sql';

export const decisionSmsLines = pgTable(
  'decision_sms_lines',
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
    uniqueIndex('decision_sms_lines_process_instance_id_uniq').on(
      table.processInstanceId,
    ),
    uniqueIndex('decision_sms_lines_phone_number_uniq').on(table.phoneNumber),
  ],
);

export type DecisionSmsLine = typeof decisionSmsLines.$inferSelect;
