import { index, jsonb, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { profiles } from './profiles.sql';

/**
 * A reusable form definition described by a JSON Schema. The form is
 * attached to a profile via `profileId` — typically the decision process
 * profile that wants every submitter to fill in extra fields — and the
 * `schema` column holds the full JSON Schema used at render and
 * validation time.
 */
export const customForms = pgTable(
  'custom_forms',
  {
    id: autoId().primaryKey(),

    // The profile this form is attached to.
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    // Human-readable name, also used for lookups within a profile.
    name: varchar({ length: 256 }).notNull(),

    // JSON Schema describing the form's fields.
    schema: jsonb().$type<Record<string, unknown>>().notNull(),

    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.profileId).concurrently(),
  ],
);

export type CustomForm = typeof customForms.$inferSelect;
