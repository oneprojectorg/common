import { relations } from 'drizzle-orm';
import type { InferModel } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  text,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { processInstances } from './processInstances.sql';
import { profiles } from './profiles.sql';

export const decisionProcesses = pgTable(
  'decision_processes',
  {
    id: autoId().primaryKey(),
    name: varchar({ length: 256 }).notNull(),
    description: text(),

    // Complete process definition as JSON Schema
    processSchema: jsonb('process_schema').notNull(),
    /* processSchema contains:
      {
        "budget": number,
        "fields": { ...JSONSchema },
        "states": [ ...state definitions ],
        "transitions": [ ...transition rules ],
        "votingDefinition": { ...JSONSchema },
        "proposalTemplate": { ...JSONSchema }
      }
    */

    createdByProfileId: uuid('created_by_profile_id')
      .notNull()
      .references(() => profiles.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.id).concurrently(),
    index().on(table.createdByProfileId).concurrently(),
    index('decision_processes_name_gin_index')
      .using('gin', table.name)
      .concurrently(),
  ],
);

export const decisionProcessesRelations = relations(
  decisionProcesses,
  ({ one, many }) => ({
    createdBy: one(profiles, {
      fields: [decisionProcesses.createdByProfileId],
      references: [profiles.id],
    }),
    instances: many(processInstances),
  }),
);

export type DecisionProcess = InferModel<typeof decisionProcesses>;
