import { InferModel, relations } from 'drizzle-orm';
import { index, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { attachments } from './attachments.sql';
import { comments } from './comments.sql';
import { organizations } from './organizations.sql';
import { postReactions } from './postReactions.sql';
import { profiles } from './profiles.sql';

export const posts = pgTable(
  'posts',
  {
    id: autoId().primaryKey(),
    content: text().notNull(),
    parentPostId: uuid().references((): any => posts.id, {
      onDelete: 'cascade',
    }),
    profileId: uuid().references(() => profiles.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.id).concurrently(),
    index().on(table.parentPostId).concurrently(),
  ],
);

export const postsToOrganizations = pgTable(
  'posts_to_organizations',
  {
    postId: uuid()
      .notNull()
      .references(() => posts.id, {
        onDelete: 'cascade',
      }),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id, {
        onDelete: 'cascade',
      }),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    primaryKey({ columns: [table.organizationId, table.postId] }),
  ],
);

export const postsRelations = relations(posts, ({ one, many }) => ({
  organization: many(organizations),
  attachments: many(attachments),
  reactions: many(postReactions),
  comments: many(comments),
  profile: one(profiles, {
    fields: [posts.profileId],
    references: [profiles.id],
  }),
  parentPost: one(posts, {
    fields: [posts.parentPostId],
    references: [posts.id],
    relationName: 'PostToParent',
  }),
  childPosts: many(posts, {
    relationName: 'PostToParent',
  }),
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

export type Post = InferModel<typeof posts>;
export type PostToOrganization = InferModel<typeof postsToOrganizations>;
