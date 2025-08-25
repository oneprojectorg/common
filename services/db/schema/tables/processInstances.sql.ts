import { relations, sql } from 'drizzle-orm';
import type { InferModel, SQL } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import {
  autoId,
  enumToPgEnum,
  serviceRolePolicies,
  timestamps,
  tsvector,
} from '../../helpers';
import { decisionProcesses } from './decisionProcesses.sql';
import { profiles } from './profiles.sql';
import { proposals } from './proposals.sql';
import { stateTransitionHistory } from './stateTransitionHistory.sql';

export enum ProcessStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export const processStatusEnum = pgEnum(
  'decision_process_status',
  enumToPgEnum(ProcessStatus),
);

export const processInstances = pgTable(
  'decision_process_instances',
  {
    id: autoId().primaryKey(),
    processId: uuid('process_id')
      .notNull()
      .references(() => decisionProcesses.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    name: varchar({ length: 256 }).notNull(),
    description: text(),

    // Instance configuration with filled values
    instanceData: jsonb('instance_data').notNull(),
    /* instanceData contains:
      {
        "budget": number,
        "fieldValues": { ...based on process fields schema },
        "phases": [ ...configured phases with dates ],
        "currentStateId": string,
        "stateData": { ...state-specific data }
      }
    */

    // Current state tracking
    currentStateId: varchar({ length: 256 }),

    ownerProfileId: uuid('owner_profile_id')
      .notNull()
      .references(() => profiles.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    status: processStatusEnum('status').default(ProcessStatus.DRAFT),
    search: tsvector('search').generatedAlwaysAs(
      (): SQL =>
        sql`setweight(to_tsvector('simple', ${processInstances.name}), 'A') || ' ' || setweight(to_tsvector('english', COALESCE(${processInstances.description}, '')), 'B')::tsvector`,
    ),

    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.id).concurrently(),
    index().on(table.processId).concurrently(),
    index().on(table.ownerProfileId).concurrently(),
    index().on(table.currentStateId).concurrently(),
    index('process_instances_search_index').using('gin', table.search),
  ],
);

export const processInstancesRelations = relations(
  processInstances,
  ({ one, many }) => ({
    process: one(decisionProcesses, {
      fields: [processInstances.processId],
      references: [decisionProcesses.id],
    }),
    owner: one(profiles, {
      fields: [processInstances.ownerProfileId],
      references: [profiles.id],
    }),
    proposals: many(proposals),
    stateTransitions: many(stateTransitionHistory),
  }),
);

export type ProcessInstance = InferModel<typeof processInstances>;
