import { InferModel } from 'drizzle-orm';
import { relations } from 'drizzle-orm/_relations';
import { index, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { attachments } from './attachments.sql';
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
    index().on(table.profileId).concurrently(),
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
    index().on(table.postId),
  ],
);

export const postsToProfiles = pgTable(
  'posts_to_profiles',
  {
    postId: uuid()
      .notNull()
      .references(() => posts.id, {
        onDelete: 'cascade',
      }),
    profileId: uuid()
      .notNull()
      .references(() => profiles.id, {
        onDelete: 'cascade',
      }),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    primaryKey({ columns: [table.postId, table.profileId] }),
    index('posts_to_profiles_post_id_idx').on(table.postId).concurrently(),
    index('posts_to_profiles_profile_id_idx')
      .on(table.profileId)
      .concurrently(),
  ],
);

export const postsRelations = relations(posts, ({ one, many }) => ({
  organization: many(organizations),
  attachments: many(attachments),
  reactions: many(postReactions),
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
  postsToProfiles: many(postsToProfiles),
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

export const postsToProfilesRelations = relations(
  postsToProfiles,
  ({ one }) => ({
    post: one(posts, {
      fields: [postsToProfiles.postId],
      references: [posts.id],
    }),
    profile: one(profiles, {
      fields: [postsToProfiles.profileId],
      references: [profiles.id],
    }),
  }),
);

export type Post = InferModel<typeof posts>;
export type PostToOrganization = InferModel<typeof postsToOrganizations>;
export type PostToProfile = InferModel<typeof postsToProfiles>;
