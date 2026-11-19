import { sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import {
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies } from '../../helpers';
import { profiles } from './profiles.sql';

/**
 * A content-addressed, immutable version of a form's JSON Schema — a rubric
 * today, a proposal template next. Rows are never updated: saving a template
 * inserts a child of the version currently in force (`parentId`), and the
 * owner (`instance_data.rubricFormSchemaId`, `phases[].rubricFormSchemaId`)
 * moves its pointer to the new head.
 *
 * `schemaHash` is generated, not written, so two callers cannot disagree about
 * a row's identity, and the `NULLS NOT DISTINCT` unique makes re-saving an
 * unchanged template a no-op insert (root versions share a NULL parent, which
 * a plain unique would treat as always-distinct).
 *
 * Entities that hold values stamp the version they were written against
 * (`decision_proposal_reviews.form_schema_id`) with `ON DELETE RESTRICT`: a
 * schema cannot vanish while a value still needs it to be read.
 */
export const formSchemas = pgTable(
  'form_schemas',
  {
    id: autoId().primaryKey(),

    // The version this one was derived from; NULL for a lineage root.
    // A self-reference needs the explicit `AnyPgColumn` return type: without
    // it the table's type refers to itself through the callback.
    parentId: uuid('parent_id').references((): AnyPgColumn => formSchemas.id, {
      onUpdate: 'cascade',
      onDelete: 'restrict',
    }),

    // The full JSON Schema document.
    schema: jsonb().$type<Record<string, unknown>>().notNull(),

    // Content address of `schema`. Generated so it always matches the column.
    schemaHash: text('schema_hash').generatedAlwaysAs(sql`md5(schema::text)`),

    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    })
      .notNull()
      .defaultNow(),

    createdByProfileId: uuid('created_by_profile_id').references(
      () => profiles.id,
      {
        onUpdate: 'cascade',
        onDelete: 'set null',
      },
    ),
  },
  (table) => [
    ...serviceRolePolicies,
    unique('form_schemas_parent_hash_unique')
      .on(table.parentId, table.schemaHash)
      .nullsNotDistinct(),
  ],
);

export type FormSchema = typeof formSchemas.$inferSelect;
