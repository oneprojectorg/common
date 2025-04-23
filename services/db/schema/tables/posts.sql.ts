import { relations } from 'drizzle-orm';
import { index, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';

import { organizations } from './organizations.sql';

export const posts = pgTable(
  'posts',
  {
    id: autoId().primaryKey(),
    content: text().notNull(),
    ...timestamps,
  },
  table => [...serviceRolePolicies, index().on(table.id).concurrently()],
);

export const postsToOrganizations = pgTable(
  'posts_to_organizations',
  {
    postId: uuid()
      .notNull()
      .references(() => posts.id),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id),
    ...timestamps,
  },
  table => [
    ...serviceRolePolicies,
    primaryKey({ columns: [table.organizationId, table.postId] }),
  ],
);

export const postsRelations = relations(posts, ({ many }) => ({
  organization: many(organizations),
}));

export const postsToOrganizationsRelations = relations(
  postsToOrganizations,
  ({ one }) => ({
    post: one(posts, {
      fields: [postsToOrganizations.postId],
      references: [posts.id],
    }),
    organization: one(organizations, {
      fields: [postsToOrganizations.organizationId],
      references: [organizations.id],
    }),
  }),
);
