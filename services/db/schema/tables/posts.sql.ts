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
    // Profile that gates read access for this post. Resolved once at write
    // time: top-level on a decision/org/individual profile = that profile;
    // top-level on a proposal = the proposal's parent decision profile;
    // comment/reply = inherits the parent post's rootProfileId. NULL = no
    // gate (public). Auth checks dispatch on the gate profile's `type`.
    rootProfileId: uuid().references(() => profiles.id, {
      onDelete: 'cascade',
    }),
    // Top-level post in this thread. NULL for top-level posts; for
    // comments/replies at any depth, points at the original top-level post.
    // Lets thread queries skip recursive parent walks.
    rootPostId: uuid().references((): any => posts.id, {
      onDelete: 'cascade',
    }),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.id).concurrently(),
    index().on(table.profileId).concurrently(),
    index().on(table.parentPostId).concurrently(),
    index().on(table.rootProfileId),
    index().on(table.rootPostId),
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
    // Feed sort: WHERE organization_id = ? ORDER BY created_at DESC, post_id DESC.
    // Lets the org feed read the page straight from the index without a sort.
    index('posts_to_organizations_org_id_created_at_post_id_idx').on(
      table.organizationId,
      table.createdAt.desc(),
      table.postId.desc(),
    ),
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
    // Feed sort: WHERE profile_id = ? ORDER BY created_at DESC, post_id DESC.
    // Supersedes the single-column profile_id idx (same leading column).
    index('posts_to_profiles_profile_id_created_at_post_id_idx').on(
      table.profileId,
      table.createdAt.desc(),
      table.postId.desc(),
    ),
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
  rootProfile: one(profiles, {
    fields: [posts.rootProfileId],
    references: [profiles.id],
    relationName: 'PostToRootProfile',
  }),
  rootPost: one(posts, {
    fields: [posts.rootPostId],
    references: [posts.id],
    relationName: 'PostToRoot',
  }),
  threadPosts: many(posts, {
    relationName: 'PostToRoot',
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
