import { relations, sql } from 'drizzle-orm';
import {
  index,
  pgTable,
  primaryKey,
  text,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { authUsers } from 'drizzle-orm/supabase';

import { serviceRolePolicies } from '../../helpers/policies';
import { timestamps } from '../../helpers/timestamps';

import { accessRoles } from './access.sql';
import { organizations } from './organizations.sql';

export const profiles = pgTable(
  'profiles',
  {
    id: uuid()
      .primaryKey()
      .notNull()
      .references(() => authUsers.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    username: varchar({ length: 256 }).unique(),
    name: varchar({ length: 256 }),
    avatarUrl: text(),
    email: varchar().notNull().unique(),
    about: varchar({ length: 256 }),
    organizationId: uuid().references(() => organizations.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.id).concurrently(),
    index().on(table.email).concurrently(),
    index().on(table.username).concurrently(),
    index('profiles_email_gin_index')
      .using('gin', sql`to_tsvector('english', ${table.email})`)
      .concurrently(),
    index('profiles_username_gin_index')
      .using('gin', sql`to_tsvector('english', ${table.username})`)
      .concurrently(),
    index('profiles_organizations_idx').on(table.organizationId).concurrently(),
  ],
);

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  user: one(authUsers, {
    fields: [profiles.id],
    references: [authUsers.id],
  }),
  organization: one(organizations, {
    fields: [profiles.organizationId],
    references: [organizations.id],
  }),
  roles: many(accessRoles),
}));

export const profilesToAccessRoles = pgTable(
  'profiles_to_access_roles',
  {
    profileId: uuid()
      .notNull()
      .references(() => profiles.id),
    accessRoleId: uuid()
      .notNull()
      .references(() => accessRoles.id),
  },
  (table) => [primaryKey({ columns: [table.profileId, table.accessRoleId] })],
);

export const profilesToAccessRolesRelations = relations(
  profilesToAccessRoles,
  ({ one }) => ({
    profile: one(profiles, {
      fields: [profilesToAccessRoles.profileId],
      references: [profiles.id],
    }),
    accessRole: one(accessRoles, {
      fields: [profilesToAccessRoles.accessRoleId],
      references: [accessRoles.id],
    }),
  }),
);
