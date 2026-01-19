import { sql } from 'drizzle-orm';
import type { InferModel } from 'drizzle-orm';
import { relations } from 'drizzle-orm/_relations';
import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { processInstances } from './processInstances.sql';

export const decisionProcessTransitions = pgTable(
  'decision_process_transitions',
  {
    id: autoId().primaryKey(),
    processInstanceId: uuid('process_instance_id')
      .notNull()
      .references(() => processInstances.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    fromStateId: varchar('from_state_id', { length: 256 }),
    toStateId: varchar('to_state_id', { length: 256 }).notNull(),

    scheduledDate: timestamp('scheduled_date', {
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    completedAt: timestamp('completed_at', {
      withTimezone: true,
      mode: 'string',
    }),

    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.id).concurrently(),
    index('idx_transitions_instance_scheduled')
      .on(table.processInstanceId, table.scheduledDate)
      .concurrently(),
    index('idx_transitions_pending')
      .on(table.scheduledDate)
      .where(sql`completed_at IS NULL`)
      .concurrently(),
    index('idx_transitions_state')
      .on(table.processInstanceId, table.toStateId)
      .concurrently(),
  ],
);

export const decisionProcessTransitionsRelations = relations(
  decisionProcessTransitions,
  ({ one }) => ({
    processInstance: one(processInstances, {
      fields: [decisionProcessTransitions.processInstanceId],
      references: [processInstances.id],
    }),
  }),
);

export type DecisionProcessTransition = InferModel<
  typeof decisionProcessTransitions
>;
