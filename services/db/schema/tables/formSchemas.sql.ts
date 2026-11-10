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

/**
 * Generic JSON Schema storage scoped to a decision instance. Proposals point
 * at a row through `decision_proposals.form_schema_id`; null there means the
 * instance template.
 */
export const formSchemas = pgTable(
  'decision_form_schemas',
  {
    id: autoId().primaryKey(),

    processInstanceId: uuid('process_instance_id')
      .notNull()
      .references(() => processInstances.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    name: varchar('name', { length: 256 }).notNull(),

    schema: jsonb('schema').$type<Record<string, unknown>>().notNull(),

    createdAt: timestamp({
      withTimezone: true,
      mode: 'string',
    }).default(sql`(now() AT TIME ZONE 'utc'::text)`),
  },
  (table) => [...serviceRolePolicies, index().on(table.processInstanceId)],
);

export type FormSchema = typeof formSchemas.$inferSelect;
