import { relations } from 'drizzle-orm';
import { index, pgTable, uniqueIndex, varchar } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { posts } from './posts.sql';
import { users } from './users.sql';

export const postReactions = pgTable(
  'post_reactions',
  {
    id: autoId().primaryKey(),
    postId: autoId()
      .notNull()
      .references(() => posts.id, {
        onDelete: 'cascade',
      }),
    userId: autoId()
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
      }),
    reactionType: varchar({ length: 50 }).notNull(),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.postId).concurrently(),
    index().on(table.userId).concurrently(),
    index().on(table.reactionType).concurrently(),
    uniqueIndex().on(table.postId, table.userId, table.reactionType),
  ],
);

export const postReactionsRelations = relations(postReactions, ({ one }) => ({
  post: one(posts, {
    fields: [postReactions.postId],
    references: [posts.id],
  }),
  user: one(users, {
    fields: [postReactions.userId],
    references: [users.id],
  }),
}));
