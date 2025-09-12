import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  pgTable,
  text,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { authUsers } from 'drizzle-orm/supabase';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { organizationUsers } from './organizationUsers.sql';
import { organizations } from './organizations.sql';
import { profiles } from './profiles.sql';
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
    lastOrgId: uuid().references(() => organizations.id, {
      onDelete: 'set null',
    }),
    profileId: uuid().references(() => profiles.id, {
      onDelete: 'set null',
    }),
    currentProfileId: uuid().references(() => profiles.id, {
      onDelete: 'set null',
    }),
    tos: boolean(),
    privacy: boolean(),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.id).concurrently(),
    index().on(table.authUserId).concurrently(),
    index().on(table.profileId).concurrently(),
    index().on(table.avatarImageId),
    index().on(table.lastOrgId),
    index().on(table.currentProfileId),
    index().on(table.email).concurrently(),
    index('users_email_gin_index')
      .using('gin', sql`to_tsvector('english', ${table.email})`)
      .concurrently(),
    index('users_username_gin_index')
      .using('gin', sql`to_tsvector('english', ${table.username})`)
      .concurrently(),
  ],
);

export const usersRelations = relations(users, ({ many, one }) => ({
  organizationUsers: many(organizationUsers),
  currentOrganization: one(organizations, {
    fields: [users.lastOrgId],
    references: [organizations.id],
  }),
  profile: one(profiles, {
    fields: [users.profileId],
    references: [profiles.id],
  }),
  currentProfile: one(profiles, {
    fields: [users.currentProfileId],
    references: [profiles.id],
  }),
  avatarImage: one(objectsInStorage, {
    fields: [users.avatarImageId],
    references: [objectsInStorage.id],
  }),
}));
