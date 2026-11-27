import type { InferModel } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm/_relations';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  unique,
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

    // When the selection into this phase was settled: at the transition when
    // it needs no approval, else when an admin confirmed it. Null while
    // waiting; any attached proposals stay out of the phase until then.
    selectionConfirmedAt: timestamp('selection_confirmed_at', {
      withTimezone: true,
    }),

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
    unique('transition_history_process_instance_uniq').on(
      table.processInstanceId,
      table.id,
    ),
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
