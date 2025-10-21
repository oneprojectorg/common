import { eq, relations } from 'drizzle-orm';
import type { InferModel } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

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
    }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),

    completed: boolean('completed').default(false).notNull(),
    autoProcessed: boolean('auto_processed').default(false).notNull(),
    selectionFunctionFailed: boolean('selection_function_failed')
      .default(false)
      .notNull(),
    selectionError: jsonb('selection_error'),

    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.id).concurrently(),
    index('idx_transitions_instance_scheduled')
      .on(table.processInstanceId, table.scheduledDate)
      .concurrently(),
    index('idx_transitions_pending')
      .on(table.completed, table.scheduledDate)
      .where(eq(table.completed, false))
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
