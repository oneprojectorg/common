import { relations, sql } from 'drizzle-orm';
import { index, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { authUsers } from 'drizzle-orm/supabase';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';

import { organizations } from './organizations.sql';
import { organizationUsers } from './organizationUsers.sql';
import { objectsInStorage } from './storage.sql';

export const users = pgTable(
  'users',
  {
    id: autoId().primaryKey(),
    authUserId: uuid()
      .notNull()
      .references(() => authUsers.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    username: varchar({ length: 256 }),
    name: varchar({ length: 256 }),
    email: varchar().notNull().unique(),
    about: text(),
    title: varchar({ length: 256 }),
    avatarImageId: uuid().references(() => objectsInStorage.id, {
      onUpdate: 'cascade',
    }),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.id).concurrently(),
    index().on(table.email).concurrently(),
    index().on(table.username).concurrently(),
    index('users_email_gin_index')
      .using('gin', sql`to_tsvector('english', ${table.email})`)
      .concurrently(),
    index('users_username_gin_index')
      .using('gin', sql`to_tsvector('english', ${table.username})`)
      .concurrently(),
  ],
);

export const usersOrganizationsRelations = relations(
  organizationUsers,
  ({ many }) => ({
    organizations: many(organizations),
  }),
);
