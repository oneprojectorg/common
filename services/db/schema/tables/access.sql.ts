import { index, pgTable, unique, uuid, varchar } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { profiles } from './profiles.sql';

/**
 * Access Roles table - defines roles that can be assigned to users
 * Matches AccessRoleSchema from access-zones library
 *
 * Roles get their permissions through the accessRolePermissionsOnAccessZones junction table
 * Multiple roles can be assigned to a user and are combined with OR logic
 *
 * Roles can be global (profileId IS NULL) or profile-specific (profileId references a profile)
 * When querying roles for a profile, both global and profile-specific roles are returned
 */
export const accessRoles = pgTable(
  'access_roles',
  {
    id: autoId().primaryKey(),
    name: varchar({ length: 255 }).notNull(), // Role name (e.g., 'Admin', 'Editor', 'Viewer')
    description: varchar({ length: 500 }),
    profileId: uuid().references(() => profiles.id, { onDelete: 'cascade' }), // NULL = global role, set = profile-specific
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.id).concurrently(),
    index('access_roles_profile_id_idx').on(table.profileId).concurrently(),
    unique('access_roles_name_profile_unique').on(table.name, table.profileId),
  ],
);

export type AccessRole = typeof accessRoles.$inferSelect;
