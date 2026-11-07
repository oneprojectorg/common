import { sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies } from '../../helpers';
import { processInstances } from './processInstances.sql';
import { profiles } from './profiles.sql';

/**
 * Generic JSON Schema storage scoped to a decision instance. Rows are
 * immutable: a new version is a new row whose `parentId` points at the one it
 * replaces. Proposals point at a row through `decision_proposals.form_schema_id`;
 * null there means the instance template.
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

    // The previous version; null for the first one.
    parentId: uuid('parent_id').references((): AnyPgColumn => formSchemas.id, {
      onDelete: 'restrict',
    }),

    name: varchar('name', { length: 256 }).notNull(),

    schema: jsonb('schema').$type<Record<string, unknown>>().notNull(),

    // jsonb::text is canonical, so equal schemas hash equally.
    schemaHash: text('schema_hash').generatedAlwaysAs(sql`md5("schema"::text)`),

    createdByProfileId: uuid('created_by_profile_id').references(
      () => profiles.id,
      {
        onUpdate: 'cascade',
        onDelete: 'set null',
      },
    ),

    // No updatedAt / deletedAt: rows are never updated or soft-deleted.
    createdAt: timestamp({
      withTimezone: true,
      mode: 'string',
    }).default(sql`(now() AT TIME ZONE 'utc'::text)`),
  },
  (table) => [
    ...serviceRolePolicies,
    unique('form_schemas_version_uniq')
      .on(table.processInstanceId, table.parentId, table.schemaHash)
      .nullsNotDistinct(),
    index().on(table.processInstanceId),
    index().on(table.parentId),
  ],
);

export type FormSchema = typeof formSchemas.$inferSelect;
