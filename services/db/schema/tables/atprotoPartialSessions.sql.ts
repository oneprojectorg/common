import { index, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies } from '../../helpers';

export const atprotoPartialSessions = pgTable(
  'atprotoPartialSessions',
  {
    id: autoId().primaryKey(),
    did: varchar({ length: 256 }).notNull(),
    handle: varchar({ length: 256 }).notNull(),
    displayName: varchar({ length: 256 }),
    avatarUrl: text(),
    bio: text(),
    accessToken: text().notNull(),
    refreshToken: text(),
    tokenExpiry: timestamp({
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    createdAt: timestamp({
      withTimezone: true,
      mode: 'string',
    }).notNull(),
    expiresAt: timestamp({
      withTimezone: true,
      mode: 'string',
    }).notNull(),
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.id).concurrently(),
    index().on(table.did).concurrently(),
    index().on(table.expiresAt).concurrently(),
  ],
);
