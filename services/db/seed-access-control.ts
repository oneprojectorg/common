/* eslint-disable antfu/no-top-level-await */
/**
 * Minimal seed script to insert access control data (roles, zones, permissions).
 * Used for Docker dev environment where the standard seed script's URL allowlist
 * doesn't include the dind database URL.
 */
import { db } from '.';
import { accessRoles } from './schema/tables/access.sql';
import {
  accessRolePermissionsOnAccessZones,
  accessZones,
} from './schema/tables/accessZones.sql';
import {
  ACCESS_ROLES,
  ACCESS_ROLE_PERMISSIONS,
  ACCESS_ZONES,
} from './seedData/accessControl';

console.log('Seeding access control data...');

// Insert access zones
await db.insert(accessZones).values(ACCESS_ZONES).onConflictDoNothing();

console.log(`Inserted ${ACCESS_ZONES.length} access zones`);

// Insert access roles
await db.insert(accessRoles).values(ACCESS_ROLES).onConflictDoNothing();

console.log(`Inserted ${ACCESS_ROLES.length} access roles`);

// Insert role permissions
await db
  .insert(accessRolePermissionsOnAccessZones)
  .values(ACCESS_ROLE_PERMISSIONS)
  .onConflictDoNothing();

console.log(`Inserted ${ACCESS_ROLE_PERMISSIONS.length} role permissions`);

await db.$client.end();

console.log('Done!');
