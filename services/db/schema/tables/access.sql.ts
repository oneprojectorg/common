import { relations } from 'drizzle-orm';
import { index, integer, pgTable, varchar } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';

export const accessRoles = pgTable(
  'access_roles',
  {
    id: autoId().primaryKey(),
    name: varchar({ length: 255 }).notNull(),
    access: integer(),
    ...timestamps,
  },
  (table) => [...serviceRolePolicies, index().on(table.id).concurrently()],
);

// Note: Relations are defined in the respective files to avoid circular imports
// accessZones.sql.ts handles accessRolePermissionsOnAccessZones relations
// organizationUsers.sql.ts handles organizationUserToAccessRoles relations
