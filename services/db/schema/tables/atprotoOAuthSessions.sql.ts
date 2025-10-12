import { index, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies } from '../../helpers';

export const atprotoOAuthSessions = pgTable(
  'atprotoOAuthSessions',
  {
    id: autoId().primaryKey(),
    state: varchar({ length: 256 }).notNull().unique(),
    codeVerifier: varchar({ length: 256 }).notNull(),
    handle: varchar({ length: 256 }).notNull(),
    did: varchar({ length: 256 }),
    redirectUri: text().notNull(),
    dpopKeyPair: text().notNull(),
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
    index().on(table.state).concurrently(),
    index().on(table.expiresAt).concurrently(),
  ],
);
