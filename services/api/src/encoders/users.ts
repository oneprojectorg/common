import {
  accessRoleMinimalSchema,
  profileUserWithProfileSchema,
} from '@op/common/client';
import { authUsers, organizationUsers, users } from '@op/db/schema';
import type { ZonePermissions } from 'access-zones';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { permissionsSchema } from './access';
import {
  organizationsEncoder,
  organizationsWithProfileEncoder,
} from './organizations';
import { baseProfileEncoder } from './profiles';
import { storageItemEncoder } from './storageItem';

const zonePermissionsSchema = z.record(
  z.string(),
  permissionsSchema,
) satisfies z.ZodType<ZonePermissions>;

const accessZoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
});

const zonePermissionSchema = z.object({
  accessRoleId: z.string(),
  accessZoneId: z.string(),
  permission: z.number(),
  accessZone: accessZoneSchema,
});

// Extend the shared minimal encoder with zone permissions for full role context
const accessRoleSchema = accessRoleMinimalSchema.extend({
  zonePermissions: z.array(zonePermissionSchema).nullish(),
});

const roleJunctionSchema = z.object({
  accessRole: accessRoleSchema,
});

// Extended organization user schema that includes permissions and role data
// Used when returning user data with full organizational context
const organizationUserWithPermissionsEncoder = createSelectSchema(
  organizationUsers,
).extend({
  organization: organizationsEncoder.nullish(),
  permissions: zonePermissionsSchema.nullish(),
  roles: z.array(roleJunctionSchema).nullish(),
});

// Shared base + profile, plus computed permissions. Roles are omitted: they're
// fetched only to derive `permissions` and no client reads them off the account.
const profileUserWithPermissionsEncoder = profileUserWithProfileSchema.extend({
  permissions: zonePermissionsSchema.nullish(),
});

/**
 * Complete user data encoder with all relational data
 * Includes avatar, organization memberships, roles, and profile information
 */
export const userEncoder = createSelectSchema(users).extend({
  onboardedAt: z.string().nullish(),
  // Whether the underlying auth identity is an anonymous sign-in. Sourced by
  // every producer from the Supabase session (`ctx.user.is_anonymous`) — or the
  // admin's own auth fetch for cross-user procedures — so it never depends on
  // loading the `authUser` relation.
  isAnonymous: z.boolean(),
  // The `authUser` relation is loaded only by the platform-admin user list
  // (for `lastSignInAt`); callers project different column subsets, so keep
  // every column optional. `.nullish()` covers procedures that don't load it.
  authUser: createSelectSchema(authUsers).partial().nullish(),
  avatarImage: storageItemEncoder.nullish(),
  organizationUsers: organizationUserWithPermissionsEncoder.array().nullish(),
  profileUsers: profileUserWithPermissionsEncoder.array().nullish(),
  currentOrganization: organizationsWithProfileEncoder.nullish(),
  currentProfile: baseProfileEncoder.nullish(),
  profile: baseProfileEncoder.nullish(),
});

export type CommonUser = z.infer<typeof userEncoder>;

/**
 * Encode a DB user row into a `CommonUser`, deriving the required `isAnonymous`
 * flag from the caller's Supabase auth identity (`ctx.user`, or an admin
 * `getUserById` result) rather than the DB `authUser` relation. Centralizes the
 * "read it from the live session, never query `authUser` for it" rule so every
 * producer of the caller's-own (or an admin-fetched) account stays consistent.
 */
export const encodeUser = ({
  user,
  authUser,
}: {
  user: Record<string, unknown>;
  authUser: { is_anonymous?: boolean | null };
}): CommonUser =>
  userEncoder.parse({ ...user, isAnonymous: Boolean(authUser.is_anonymous) });
