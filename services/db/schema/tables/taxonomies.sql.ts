import { relations } from 'drizzle-orm';
import {
  jsonb,
  pgTable,
  text,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';

export const taxonomies = pgTable(
  'taxonomies',
  {
    id: autoId().primaryKey(),
    name: varchar('name', { length: 255 }).notNull().unique(),
    description: text('description'),
    namespaceUri: varchar('namespace_uri', { length: 255 }),
    ...timestamps,
  },
  () => [...serviceRolePolicies],
);

export const taxonomiesRelations = relations(taxonomies, ({ many }) => ({
  taxonomyTerms: many(taxonomyTerms),
}));

// @ts-expect-error - TODO: this recursion of the parentId causes inference to fail
export const taxonomyTerms = pgTable(
  'taxonomyTerms',
  {
    id: autoId().primaryKey(),
    taxonomyId: uuid('taxonomy_id').references(() => taxonomies.id),
    termUri: varchar('term_uri', { length: 255 }).notNull(),
    label: varchar('label', { length: 255 }).notNull(),
    definition: text('definition'),
    // @ts-expect-error - circular reference somehow isn't inferring the correct type
    parentId: uuid('parent_id').references(() => taxonomyTerms.id),
    // path: sql`ltree`.type('path'), // We might need this if we have deep structures. For now we leave it off though until the need arises
    data: jsonb('data'),
    ...timestamps,
  },
  (table) => {
    return {
      taxonomyTermUriUnique: unique().on(table.taxonomyId, table.termUri),
    };
  },
);

export const taxonomyTermsRelations = relations(
  taxonomyTerms,
  ({ one, many }) => ({
    taxonomy: one(taxonomies, {
      fields: [taxonomyTerms.taxonomyId],
      references: [taxonomies.id],
    }),
    parent: one(taxonomyTerms, {
      fields: [taxonomyTerms.parentId],
      references: [taxonomyTerms.id],
    }),
    children: many(taxonomyTerms, { relationName: 'parent_child' }),
  }),
);
