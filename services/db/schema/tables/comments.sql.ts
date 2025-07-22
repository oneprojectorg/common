import { InferModel, relations } from 'drizzle-orm';
import { index, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { posts } from './posts.sql';
import { profiles } from './profiles.sql';

export const comments = pgTable(
  'comments',
  {
    id: autoId().primaryKey(),
    content: text().notNull(),
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
    index('comments_profile_id_idx').on(table.profileId).concurrently(),
    index('comments_parent_comment_id_idx').on(table.parentCommentId).concurrently(),
  ],
);

export const commentsToPost = pgTable(
  'comments_to_posts',
  {
    commentId: uuid()
      .notNull()
      .references(() => comments.id, {
        onDelete: 'cascade',
      }),
    postId: uuid()
      .notNull()
      .references(() => posts.id, {
        onDelete: 'cascade',
      }),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    primaryKey({ columns: [table.commentId, table.postId] }),
    index('comments_to_posts_comment_id_idx').on(table.commentId).concurrently(),
    index('comments_to_posts_post_id_idx').on(table.postId).concurrently(),
  ],
);


export const commentsRelations = relations(comments, ({ one, many }) => ({
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
  commentsToPost: many(commentsToPost),
}));

export const commentsToPostRelations = relations(commentsToPost, ({ one }) => ({
  comment: one(comments, {
    fields: [commentsToPost.commentId],
    references: [comments.id],
  }),
  post: one(posts, {
    fields: [commentsToPost.postId],
    references: [posts.id],
  }),
}));


// Add foreign key constraint for self-reference after table definition
// This is handled by the references() call above

export type Comment = InferModel<typeof comments>;
export type CommentToPost = InferModel<typeof commentsToPost>;
