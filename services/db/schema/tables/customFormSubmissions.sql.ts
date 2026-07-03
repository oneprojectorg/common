import { index, jsonb, pgTable, uuid } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { customForms } from './customForms.sql';
import { profiles } from './profiles.sql';

/**
 * A single submission of a `custom_forms` row. The submission is attached
 * to a target entity via `profileId` — for a proposal idea submission,
 * `profileId` is the proposal's own profile. The kind of entity the
 * submission belongs to is read off the attached profile's `type` column,
 * so this row doesn't denormalize it. The schema the data was validated
 * against lives on the referenced `custom_forms` row.
 */
export const customFormSubmissions = pgTable(
  'custom_form_submissions',
  {
    id: autoId().primaryKey(),

    customFormId: uuid('custom_form_id')
      .notNull()
      .references(() => customForms.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    // The target entity's profile — e.g. the proposal's `profileId`.
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    data: jsonb().$type<Record<string, unknown>>().notNull(),

    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.customFormId),
    index().on(table.profileId),
  ],
);

export type CustomFormSubmission = typeof customFormSubmissions.$inferSelect;
