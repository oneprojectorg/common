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
import { organizations } from './organizations.sql';
import { users } from './users.sql';

export const organizationUsers = pgTable(
  'organization_users',
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
    organizationId: uuid()
      .references(() => organizations.id, {
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
    index('organizationUsers_email_gin_index')
      .using('gin', sql`to_tsvector('english', ${table.email})`)
      .concurrently(),
    index('organizationUsers_organizations_idx')
      .on(table.organizationId)
      .concurrently(),
  ],
);

export const organizationUsersRelations = relations(
  organizationUsers,
  ({ one, many }) => ({
    // TODO: this should be the user not authuser
    serviceUser: one(users, {
      fields: [organizationUsers.authUserId],
      references: [users.authUserId],
    }),
    // user: one(authUsers, {
    // fields: [organizationUsers.id],
    // references: [authUsers.id],
    // }),
    organization: one(organizations, {
      fields: [organizationUsers.organizationId],
      references: [organizations.id],
    }),
    roles: many(accessRoles),
  }),
);

export const organizationUserToAccessRoles = pgTable(
  'organizationUser_to_access_roles',
  {
    organizationUserId: uuid()
      .notNull()
      .references(() => organizationUsers.id),
    accessRoleId: uuid()
      .notNull()
      .references(() => accessRoles.id),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    primaryKey({ columns: [table.organizationUserId, table.accessRoleId] }),
  ],
);

export const organizationUserToAccessRolesRelations = relations(
  organizationUserToAccessRoles,
  ({ one }) => ({
    organizationUser: one(organizationUsers, {
      fields: [organizationUserToAccessRoles.organizationUserId],
      references: [organizationUsers.id],
    }),
    accessRole: one(accessRoles, {
      fields: [organizationUserToAccessRoles.accessRoleId],
      references: [accessRoles.id],
    }),
  }),
);
