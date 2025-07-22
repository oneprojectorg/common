import { InferModel, relations } from 'drizzle-orm';
import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { posts } from './posts.sql';
import { profiles } from './profiles.sql';

export const comments = pgTable(
  'comments',
  {
    id: autoId().primaryKey(),
    content: text().notNull(),
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
    parentCommentId: uuid(),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index('comments_post_id_idx').on(table.postId).concurrently(),
    index('comments_profile_id_idx').on(table.profileId).concurrently(),
    index('comments_parent_comment_id_idx').on(table.parentCommentId).concurrently(),
  ],
);

export const commentsRelations = relations(comments, ({ one, many }) => ({
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
  profile: one(profiles, {
    fields: [comments.profileId],
    references: [profiles.id],
  }),
  parentComment: one(comments, {
    fields: [comments.parentCommentId],
    references: [comments.id],
    relationName: 'parentChild',
  }),
  childComments: many(comments, {
    relationName: 'parentChild',
  }),
}));

// Add foreign key constraint for self-reference after table definition
// This is handled by the references() call above

export type Comment = InferModel<typeof comments>;