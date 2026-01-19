import { InferModel } from 'drizzle-orm';
import { relations } from 'drizzle-orm/_relations';
import { index, pgTable, uniqueIndex, varchar } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { posts } from './posts.sql';
import { profiles } from './profiles.sql';

export const postReactions = pgTable(
  'post_reactions',
  {
    id: autoId().primaryKey(),
    postId: autoId()
      .notNull()
      .references(() => posts.id, {
        onDelete: 'cascade',
      }),
    profileId: autoId()
      .notNull()
      .references(() => profiles.id, {
        onDelete: 'cascade',
      }),
    reactionType: varchar({ length: 50 }).notNull(),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.postId).concurrently(),
    index().on(table.profileId).concurrently(),
    index().on(table.reactionType).concurrently(),
    uniqueIndex().on(table.postId, table.profileId, table.reactionType),
  ],
);

export const postReactionsRelations = relations(postReactions, ({ one }) => ({
  post: one(posts, {
    fields: [postReactions.postId],
    references: [posts.id],
  }),
  profile: one(profiles, {
    fields: [postReactions.profileId],
    references: [profiles.id],
  }),
}));

export type PostReaction = InferModel<typeof postReactions>;
