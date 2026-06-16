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
  isAnonymous: z.boolean(),
  avatarImage: storageItemEncoder.nullish(),
  organizationUsers: organizationUserWithPermissionsEncoder.array().nullish(),
  profileUsers: profileUserWithPermissionsEncoder.array().nullish(),
  currentOrganization: organizationsWithProfileEncoder.nullish(),
  currentProfile: baseProfileEncoder.nullish(),
  profile: baseProfileEncoder.nullish(),
});

export type CommonUser = z.infer<typeof userEncoder>;

// Platform-admin list entry: shared fields plus last sign-in (admin-only).
export const adminUserEncoder = userEncoder.extend({
  lastSignInAt: createSelectSchema(authUsers).shape.lastSignInAt.nullish(),
});

/**
 * Encode a DB user row into a `CommonUser`, taking `isAnonymous` from the
 * Supabase auth identity (`ctx.user` or an admin `getUserById` result).
 */
export const encodeUser = ({
  user,
  authUser,
}: {
  user: Record<string, unknown>;
  authUser: { is_anonymous?: boolean | null };
}): CommonUser =>
  userEncoder.parse({ ...user, isAnonymous: Boolean(authUser.is_anonymous) });
