import { index, pgTable, varchar } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';

/**
 * Access Roles table - defines roles that can be assigned to users
 * Matches AccessRoleSchema from access-zones library
 *
 * Roles get their permissions through the accessRolePermissionsOnAccessZones junction table
 * Multiple roles can be assigned to a user and are combined with OR logic
 */
export const accessRoles = pgTable(
  'access_roles',
  {
    id: autoId().primaryKey(),
    name: varchar({ length: 255 }).notNull().unique(), // Role name (e.g., 'Admin', 'Editor', 'Viewer')
    description: varchar({ length: 500 }),
    ...timestamps,
  },
  (table) => [...serviceRolePolicies, index().on(table.id).concurrently()],
);

export type AccessRole = typeof accessRoles.$inferSelect;
