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

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { accessRoles } from './access.sql';
import { profiles } from './profiles.sql';
import { users } from './users.sql';

export const profileUsers = pgTable(
  'profile_users',
  {
    id: autoId().primaryKey(),
    authUserId: uuid()
      .notNull()
      .references(() => authUsers.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),
    name: varchar({ length: 256 }),
    email: varchar().notNull(),
    about: text(),
    profileId: uuid()
      .references(() => profiles.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      })
      .notNull(),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.id).concurrently(),
    index().on(table.email).concurrently(),
    index('profileUsers_email_gin_index')
      .using('gin', sql`to_tsvector('english', ${table.email})`)
      .concurrently(),
    index('profileUsers_profile_idx').on(table.profileId).concurrently(),
    index('profileUsers_auth_user_id_idx').on(table.authUserId).concurrently(),
  ],
);

export const profileUsersRelations = relations(
  profileUsers,
  ({ one, many }) => ({
    serviceUser: one(users, {
      fields: [profileUsers.authUserId],
      references: [users.authUserId],
    }),
    profile: one(profiles, {
      fields: [profileUsers.profileId],
      references: [profiles.id],
    }),
    roles: many(profileUserToAccessRoles),
  }),
);

export const profileUserToAccessRoles = pgTable(
  'profileUser_to_access_roles',
  {
    profileUserId: uuid()
      .notNull()
      .references(() => profileUsers.id, {
        onDelete: 'cascade',
      }),
    accessRoleId: uuid()
      .notNull()
      .references(() => accessRoles.id, {
        onDelete: 'cascade',
      }),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    primaryKey({ columns: [table.profileUserId, table.accessRoleId] }),
    index('profileUser_to_access_roles_profile_user_idx')
      .on(table.profileUserId)
      .concurrently(),
    index('profileUser_to_access_roles_role_idx')
      .on(table.accessRoleId)
      .concurrently(),
  ],
);

export const profileUserToAccessRolesRelations = relations(
  profileUserToAccessRoles,
  ({ one }) => ({
    profileUser: one(profileUsers, {
      fields: [profileUserToAccessRoles.profileUserId],
      references: [profileUsers.id],
    }),
    accessRole: one(accessRoles, {
      fields: [profileUserToAccessRoles.accessRoleId],
      references: [accessRoles.id],
    }),
  }),
);
