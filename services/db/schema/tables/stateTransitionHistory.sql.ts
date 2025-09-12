import { relations } from 'drizzle-orm';
import type { InferModel } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies } from '../../helpers';
import { processInstances } from './processInstances.sql';
import { profiles } from './profiles.sql';

export const stateTransitionHistory = pgTable(
  'decision_transition_history',
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

    // Transition metadata
    transitionData: jsonb('transition_data'),

    triggeredByProfileId: uuid('triggered_by_profile_id').references(
      () => profiles.id,
      {
        onUpdate: 'cascade',
        onDelete: 'set null',
      },
    ),

    transitionedAt: timestamp('transitioned_at', { withTimezone: true })
      .notNull()
      .default(sql`(now() AT TIME ZONE 'utc'::text)`),
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.id).concurrently(),
    index().on(table.processInstanceId).concurrently(),
    index().on(table.triggeredByProfileId),
    index().on(table.toStateId).concurrently(),
    index().on(table.transitionedAt).concurrently(),
  ],
);

export const stateTransitionHistoryRelations = relations(
  stateTransitionHistory,
  ({ one }) => ({
    processInstance: one(processInstances, {
      fields: [stateTransitionHistory.processInstanceId],
      references: [processInstances.id],
    }),
    triggeredBy: one(profiles, {
      fields: [stateTransitionHistory.triggeredByProfileId],
      references: [profiles.id],
    }),
  }),
);

export type StateTransitionHistory = InferModel<typeof stateTransitionHistory>;
