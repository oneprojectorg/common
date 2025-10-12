import { relations } from 'drizzle-orm';
import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { users } from './users.sql';

export const atprotoIdentities = pgTable(
  'atprotoIdentities',
  {
    id: autoId().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    did: varchar({ length: 256 }).notNull().unique(),
    handle: varchar({ length: 256 }).notNull(),
    email: varchar({ length: 256 }).notNull(),
    displayName: varchar({ length: 256 }),
    avatarUrl: text(),
    bio: text(),
    accessToken: text().notNull(),
    refreshToken: text(),
    tokenExpiry: timestamp({
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.id).concurrently(),
    index().on(table.userId).concurrently(),
    index().on(table.did).concurrently(),
    index().on(table.email).concurrently(),
  ],
);

export const atprotoIdentitiesRelations = relations(
  atprotoIdentities,
  ({ one }) => ({
    user: one(users, {
      fields: [atprotoIdentities.userId],
      references: [users.id],
    }),
  }),
);
