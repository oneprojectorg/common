import { relations } from 'drizzle-orm';
import type { InferModel } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uuid,
} from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { processInstances } from './processInstances.sql';
import { decisionProcessResultSelections } from './decisionProcessResultSelections.sql';

export const decisionProcessResults = pgTable(
  'decision_process_results',
  {
    id: autoId().primaryKey(),
    processInstanceId: uuid('process_instance_id')
      .notNull()
      .references(() => processInstances.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    // Execution metadata
    executedAt: timestamps.createdAt,
    success: boolean('success').notNull(),
    errorMessage: text('error_message'),

    // Denormalized count for quick queries
    selectedCount: integer('selected_count').notNull().default(0),

    // Store the pipeline configuration that was executed
    pipelineConfig: jsonb('pipeline_config'),

    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.id).concurrently(),
    index('process_results_instance_date_idx')
      .on(table.processInstanceId, table.executedAt)
      .concurrently(),
    index('process_results_success_date_idx')
      .on(table.success, table.executedAt)
      .concurrently(),
  ],
);

export const decisionProcessResultsRelations = relations(
  decisionProcessResults,
  ({ one, many }) => ({
    processInstance: one(processInstances, {
      fields: [decisionProcessResults.processInstanceId],
      references: [processInstances.id],
    }),
    selections: many(decisionProcessResultSelections),
  }),
);

export type DecisionProcessResult = InferModel<typeof decisionProcessResults>;
